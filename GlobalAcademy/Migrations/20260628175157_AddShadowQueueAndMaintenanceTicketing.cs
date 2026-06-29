using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddShadowQueueAndMaintenanceTicketing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MaintenanceTickets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AcademyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourtId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    TicketStatus = table.Column<string>(type: "text", nullable: false),
                    PriorityLevel = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolutionNotes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceTickets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ShadowQueues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AcademyId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalCourtId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlayerUserId = table.Column<string>(type: "text", nullable: false),
                    OpponentUserId = table.Column<string>(type: "text", nullable: true),
                    OriginalStartTimeUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OriginalEndTimeUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    QueueStatus = table.Column<string>(type: "text", nullable: false),
                    DisplacementReason = table.Column<string>(type: "text", nullable: false),
                    DisplacedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShadowQueues", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MaintenanceTickets");

            migrationBuilder.DropTable(
                name: "ShadowQueues");
        }
    }
}
