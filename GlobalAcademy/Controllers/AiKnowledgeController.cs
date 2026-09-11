// File: Controllers/v2AiKnowledgeController.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using GlobalAcademy.Models.DTOs;
using GlobalAcademy.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Security;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/v2/ai-knowledge-ops")]
public class v2AiKnowledgeController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly string _pythonBaseUrl;
    private readonly ApplicationDbContext _dbContext;
    private readonly ITenantProvider _tenantProvider;

    public v2AiKnowledgeController(IConfiguration configuration, IHttpClientFactory httpClientFactory, ApplicationDbContext dbContext, ITenantProvider tenantProvider)
    {
        _dbContext = dbContext;
        _tenantProvider = tenantProvider;
        _httpClient = httpClientFactory.CreateClient();
        // Dynamically pull from environment settings and clip any trailing forward slashes
        var rawUrl = configuration["AiEngineSettings:BaseUrl"] ?? "http://localhost:8000";
        _pythonBaseUrl = rawUrl.TrimEnd('/');
    }

    [HttpPost("ingest-manuals")]
    public async Task<IActionResult> IngestManuals(
        [FromForm] Guid branchId, 
        [FromForm] Guid? courtId, 
        [FromForm] List<IFormFile> documentFiles)
    {
        // 🛡️ SECURITY BARRIER: Pull active runtime tenant ID from DB global user boundaries
        Guid activeAcademyId = _tenantProvider.GetTenantId(); // Replace with your exact session context tracker

        if (documentFiles == null || documentFiles.Count == 0)
            return BadRequest("Ingestion aborted: No valid PDF files attached to payload form arrays.");

        using var multiPartFormPayload = new MultipartFormDataContent();
        multiPartFormPayload.Add(new StringContent(activeAcademyId.ToString()), "academy_id");
        multiPartFormPayload.Add(new StringContent(branchId.ToString()), "branch_id");
        
        if (courtId.HasValue)
            multiPartFormPayload.Add(new StringContent(courtId.Value.ToString()), "court_id");

        foreach (var file in documentFiles)
        {
            var streamContent = new StreamContent(file.OpenReadStream());
            streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
            multiPartFormPayload.Add(streamContent, "document_files", file.FileName);
        }

        string destinationRoute = $"{_pythonBaseUrl}/api/ai/knowledge/ingest-manuals";
        var pythonResponse = await _httpClient.PostAsync(destinationRoute, multiPartFormPayload);

        if (pythonResponse.IsSuccessStatusCode)
            return Accepted(await pythonResponse.Content.ReadFromJsonAsync<object>());

        return StatusCode((int)pythonResponse.StatusCode, "Python ingestion cluster cluster error occurred.");
    }

    [HttpGet("list-uploaded-documents")]
    public async Task<IActionResult> ListUploadedDocuments()
    {
        Guid activeAcademyId = _tenantProvider.GetTenantId();
        
        string targetRoute = $"{_pythonBaseUrl}/api/ai/knowledge/list-documents?academy_id={activeAcademyId}";
        
        var response = await _httpClient.GetAsync(targetRoute);
        if (!response.IsSuccessStatusCode) return StatusCode((int)response.StatusCode);

        var snakeCaseOptions = new System.Text.Json.JsonSerializerOptions
        {
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = true
        };

        var documentsListResult = await response.Content.ReadFromJsonAsync<List<v2UploadedDocumentSummaryDto>>(snakeCaseOptions);

        return Ok(documentsListResult);
    }

    [HttpGet("view-document-contents")]
    public async Task<IActionResult> ViewDocumentContents([FromQuery] string documentName)
    {
        Guid activeAcademyId = _tenantProvider.GetTenantId();
        string encodedDocName = Uri.EscapeDataString(documentName);
        string targetRoute = $"{_pythonBaseUrl}/api/ai/knowledge/view-content?academy_id={activeAcademyId}&document_name={encodedDocName}";
        
        var response = await _httpClient.GetAsync(targetRoute);
        if (!response.IsSuccessStatusCode) return StatusCode((int)response.StatusCode);
        
        var snakeCaseOptions = new System.Text.Json.JsonSerializerOptions
        {
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = true
        };

        var documentsContentListResult = await response.Content.ReadFromJsonAsync<List<v2DocumentChunkContentDto>>(snakeCaseOptions);

        
        // Console.WriteLine($"   🚀 [DEBUG]: Retrieved {documentsContentListResult?.Count ?? 0} uploaded documents for AcademyId {activeAcademyId}");
        // documentsContentListResult?.ForEach(chunk => Console.WriteLine($"      📄 Text: '{chunk.TextContent}' | Page: {chunk.PageNumber}"));

        return Ok(documentsContentListResult);
        // return Ok(await response.Content.ReadFromJsonAsync<List<v2DocumentChunkContentDto>>());
    }

    [HttpPost("execute-pipeline-trace")]
    public async Task<IActionResult> ExecutePipelineTrace([FromBody] v2DiagnosticChatRequestDto model)
    {
        Guid activeAcademyId = _tenantProvider.GetTenantId();
        // Dynamically pull default diagnostic branch configurations for your verification pipeline
        var defaultBranch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.AcademyId == activeAcademyId);
        if (defaultBranch == null) return BadRequest("No active branch configurations found to anchor diagnostic vectors.");

        var outboundPayload = new {
            user_query = model.UserInput,
            academy_id = activeAcademyId.ToString(),
            branch_id = defaultBranch.Id.ToString(),
            voice_key = model.VoiceKey
        };

        string targetRoute = $"{_pythonBaseUrl}/api/ai/knowledge/diagnostic-query-trace";
        var response = await _httpClient.PostAsJsonAsync(targetRoute, outboundPayload);

        if (response.IsSuccessStatusCode)
            return Ok(await response.Content.ReadFromJsonAsync<v2UniversalDiagnosticChatResponseDto>());

        return StatusCode((int)response.StatusCode, "Diagnostic tracing loop rejected connection handshakes.");
    }
}
