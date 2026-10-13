using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddHistoricGraphStateCheckpointsArchive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HistoricGraphStateCheckpointsArchive",
                columns: table => new
                {
                    ArchiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    ThreadId = table.Column<Guid>(type: "uuid", nullable: false),
                    CheckpointId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    AcademyId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ActiveNode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SerializedState = table.Column<string>(type: "jsonb", nullable: false),
                    ContextTokenCount = table.Column<int>(type: "integer", nullable: false),
                    LoopIterationCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ArchivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistoricGraphStateCheckpointsArchive", x => x.ArchiveId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HistoricGraphStateCheckpointsArchive");
        }
    }
}
