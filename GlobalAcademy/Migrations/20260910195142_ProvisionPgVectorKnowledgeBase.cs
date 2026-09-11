using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class ProvisionPgVectorKnowledgeBase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "CourtMaintenanceKnowledge",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AcademyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourtId = table.Column<Guid>(type: "uuid", nullable: true),
                    DocumentName = table.Column<string>(type: "text", nullable: false),
                    TextChunkContent = table.Column<string>(type: "text", nullable: false),
                    PageNumber = table.Column<int>(type: "integer", nullable: false),
                    Embedding = table.Column<Vector>(type: "vector(1536)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourtMaintenanceKnowledge", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourtMaintenanceKnowledge_AcademyId_BranchId",
                table: "CourtMaintenanceKnowledge",
                columns: new[] { "AcademyId", "BranchId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourtMaintenanceKnowledge");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
