// File: GlobalAcademy.Models.DTOs/BranchTopologyDto.cs
using System;
using System.Collections.Generic;

namespace GlobalAcademy.Models.DTOs
{
    public class MinimalCourtMetaDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string SurfaceType { get; set; } = "Hard";
        public bool IsIndoor { get; set; }
        public string Status { get; set; } = "Open";
    }

    public class BranchTopologyMetaDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsDecommissioned { get; set; }
        public List<MinimalCourtMetaDto> Courts { get; set; } = new();
    }
}
