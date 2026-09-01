// File: GlobalAcademy.Models.DTOs/VoiceChatRequestDto.cs
using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace GlobalAcademy.Models.DTOs
{
    public class VoiceChatRequestDto
    {
        [Required]
        public IFormFile AudioFile { get; set; } = null!;
    }
}
