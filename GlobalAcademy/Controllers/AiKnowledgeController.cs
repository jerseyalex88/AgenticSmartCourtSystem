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
using GlobalAcademy.Models;

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

// File: Controllers/v2AiKnowledgeController.cs

    [HttpPost("ingest-manuals")]
    public async Task<IActionResult> IngestManuals([FromForm] List<string> branchIds, [FromForm] string? courtId, [FromForm] List<IFormFile> documentFiles)
    {
        Guid activeAcademyId = _tenantProvider.GetTenantId();

        if (branchIds == null || branchIds.Count == 0 || documentFiles == null || documentFiles.Count == 0)
        {
            return BadRequest("Missing required branch parameter collections or document binary payload targets.");
        }

        // 🚀 FORWARD THE COMPLETE GRID OF SELECTION TARGETS DOWN TO PYTHON NATIVELY
        using var multipartContent = new MultipartFormDataContent();
        multipartContent.Add(new StringContent(activeAcademyId.ToString()), "academy_id");
        
        if (!string.IsNullOrEmpty(courtId)) {
            multipartContent.Add(new StringContent(courtId), "court_id");
        }

        // Append each selected branch ID field
        foreach (var branchId in branchIds) {
            multipartContent.Add(new StringContent(branchId), "branch_ids");
        }

        foreach (var file in documentFiles)
        {
            var fileStream = file.OpenReadStream();
            var streamContent = new StreamContent(fileStream);
            streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(file.ContentType);
            multipartContent.Add(streamContent, "files", file.FileName);
        }

        string targetRoute = $"{_pythonBaseUrl}/api/ai/knowledge/ingest-manuals";
        var response = await _httpClient.PostAsync(targetRoute, multipartContent);

        if (response.IsSuccessStatusCode) return Ok();
        return StatusCode((int)response.StatusCode, "Python ingestion pipelines rejected packet synchronization bounds.");
    }

    [HttpPost("ingest-manuals-old")]
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

    // 🗑️ PURGE ENTIRE UNSTRUCTURED DOCUMENT AND ALL CORRESPONDING VECTOR CHUNKS
    [HttpDelete("delete-document")]
    public async Task<IActionResult> DeleteDocument([FromQuery] string documentName)
    {
        Guid activeAcademyId = _tenantProvider.GetTenantId();

        if (string.IsNullOrWhiteSpace(documentName))
        {
            return BadRequest("Document name parameter cannot be empty.");
        }

        // Target the specific document table slots bound strictly to the current tenant firewall
        var matchingChunks = _dbContext.CourtMaintenanceKnowledge
            .Where(k => k.AcademyId == activeAcademyId && k.DocumentName == documentName);

        if (!await matchingChunks.AnyAsync())
        {
            return NotFound("Target document not found or multi-tenant boundary isolation blocked access.");
        }

        _dbContext.CourtMaintenanceKnowledge.RemoveRange(matchingChunks);
        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = $"Document '{documentName}' and all vector embeddings successfully purged from database storage arrays." });
    }

    [HttpPost("execute-pipeline-trace")]
    public async Task<IActionResult> ExecutePipelineTrace([FromBody] v2DiagnosticChatRequestDto model)
    {
        Guid activeAcademyId = _tenantProvider.GetTenantId();
        // Dynamically pull default diagnostic branch configurations for your verification pipeline
        var defaultBranch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.AcademyId == activeAcademyId);
        if (defaultBranch == null) return BadRequest("No active branch configurations found to anchor diagnostic vectors.");

        // var outboundPayload = new {
        //     user_query = model.UserInput,
        //     academy_id = activeAcademyId.ToString(),
        //     branch_id = defaultBranch.Id.ToString(),
        //     voice_key = model.VoiceKey
        // };
        
        var outboundPayload = new {
            user_query = model.UserInput,
            academy_id = activeAcademyId.ToString(),
            branch_id = model.BranchId.ToString(), // 🚀 FIXED: Respects your active UI branch selection!
            court_id = model.CourtId?.ToString(),  // 🚀 FIXED: Passes active court context tracking!
            voice_key = model.VoiceKey
        };

        string targetRoute = $"{_pythonBaseUrl}/api/ai/knowledge/diagnostic-query-trace";
        var response = await _httpClient.PostAsJsonAsync(targetRoute, outboundPayload);

        if (response.IsSuccessStatusCode)
            return Ok(await response.Content.ReadFromJsonAsync<v2UniversalDiagnosticChatResponseDto>());

        return StatusCode((int)response.StatusCode, "Diagnostic tracing loop rejected connection handshakes.");
    }
    // 📥 1. GET ALL SAVED TEMPLATES (Respects MT Query Filters Automatically!)
        [HttpGet("list-agentquery")]
        public async Task<ActionResult<IEnumerable<SavedAgentQuery>>> GetSavedMacros()
        {
            // Due to our HasQueryFilter setup, EF Core appends the AcademyId boundary silently under the hood!
            var templates = await _dbContext.SavedAgentQueries
                .OrderByDescending(q => q.CreatedAtUtc)
                .ToListAsync();
                
            return Ok(templates);
        }

        // 💾 2. SAVE NEW TEMPLATE TO CLIPBOARD
        public record CreateMacroDto(string Title, string QueryText);
        
        [HttpPost("save-agentquery")]
        public async Task<IActionResult> SaveNewMacro([FromBody] CreateMacroDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.QueryText))
            {
                return BadRequest("Template Title and Query text properties cannot be blank string containers.");
            }

            var newMacro = new SavedAgentQuery
            {
                Id = Guid.NewGuid(),
                Title = dto.Title.Trim(),
                QueryText = dto.QueryText.Trim(),
                CreatedAtUtc = DateTime.UtcNow // Stored strictly as absolute UTC matching the Golden Rule!
            };

            _dbContext.SavedAgentQueries.Add(newMacro);
            await _dbContext.SaveChangesAsync();

            return Ok(newMacro);
        }

        // 🔄 3. UPDATE EXISTING TEMPLATE
        public record UpdateMacroDto(string Title, string QueryText);

        [HttpPut("update-agentquery/{id:guid}")]
        public async Task<IActionResult> UpdateMacro(Guid id, [FromBody] UpdateMacroDto dto)
        {
            var existingMacro = await _dbContext.SavedAgentQueries.FirstOrDefaultAsync(q => q.Id == id);
            
            if (existingMacro == null)
            {
                return NotFound("Target macro blueprint not found or multi-tenant partition fence restricted modification.");
            }

            if (!string.IsNullOrWhiteSpace(dto.Title)) existingMacro.Title = dto.Title.Trim();
            if (!string.IsNullOrWhiteSpace(dto.QueryText)) existingMacro.QueryText = dto.QueryText.Trim();
            
            await _dbContext.SaveChangesAsync();
            return Ok(existingMacro);
        }

        // 🗑️ 4. DELETE TEMPLATE FROM CLIPBOARD
        [HttpDelete("delete-agentquery/{id:guid}")]
        public async Task<IActionResult> DeleteMacro(Guid id)
        {
            var macroToDelete = await _dbContext.SavedAgentQueries.FirstOrDefaultAsync(q => q.Id == id);
            
            if (macroToDelete == null)
            {
                return NotFound("Target macro blueprint not found or multi-tenant partition fence restricted deletion.");
            }

            _dbContext.SavedAgentQueries.Remove(macroToDelete);
            await _dbContext.SaveChangesAsync();
            
            return Ok(new { Message = "Macro successfully removed from administrative clipboard memory arrays." });
        }
}
