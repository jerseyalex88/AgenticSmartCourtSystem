// File: Models/Dto/v2KnowledgeDto.cs
using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;

namespace GlobalAcademy.Models.DTOs;

// Inbound text search contract
public record v2DiagnosticChatRequestDto(string UserInput, Guid BranchId, Guid? CourtId, string VoiceKey = "en-US-JennyNeural");


// Outbound list item contract
public record v2UploadedDocumentSummaryDto(string DocumentName, Guid? CourtId, string CourtName, DateTime CreatedAtUtc);

// Outbound chunk layout for content browser
public record v2DocumentChunkContentDto(int PageNumber, string TextContent);

// Outbound diagnostic source representation matching Step 4 FlashRank outputs
public record v2RetrievedSourceChunkDto(string Id, string DocumentName, string TextContent, int PageNumber, Guid? CourtId, double RerankScore);

// Outbound RAGAS telemetry calculation matrix
public record v2RagScoreboardMetricsDto(double FaithfulnessScore, double AnswerRelevanceScore, double ContextPrecisionScore);

// Master response envelope mapping text, voice audio, text citations, and performance data
public record v2UniversalDiagnosticChatResponseDto(
    string ConversationalSpeechOutput,
    string? AudioBase64,
    List<v2RetrievedSourceChunkDto> RetractedContextSources,
    v2RagScoreboardMetricsDto PipelinePerformance
);
