using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddCourtDiagnosticsTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CourtDiagnosticSnapshots",
                columns: table => new
                {
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    AcademyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourtId = table.Column<Guid>(type: "uuid", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SurfaceFrictionIndex = table.Column<double>(type: "double precision", nullable: false),
                    BounceUniformityPercentage = table.Column<double>(type: "double precision", nullable: false),
                    NetTensionNewtons = table.Column<double>(type: "double precision", nullable: false),
                    AmbientTemperatureCelsius = table.Column<double>(type: "double precision", nullable: false),
                    HumidityPercentage = table.Column<double>(type: "double precision", nullable: false),
                    AgentVersion = table.Column<string>(type: "varchar(20)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourtDiagnosticSnapshots", x => x.SessionId);
                    table.ForeignKey(
                        name: "FK_CourtDiagnosticSnapshots_Courts_CourtId",
                        column: x => x.CourtId,
                        principalTable: "Courts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CourtDiagnosticAnomalies",
                columns: table => new
                {
                    AnomalyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    AcademyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Severity = table.Column<string>(type: "varchar(20)", nullable: false),
                    Category = table.Column<string>(type: "varchar(100)", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    ConfidenceScore = table.Column<double>(type: "double precision", nullable: false),
                    RecommendedAction = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourtDiagnosticAnomalies", x => x.AnomalyId);
                    table.ForeignKey(
                        name: "FK_CourtDiagnosticAnomalies_CourtDiagnosticSnapshots_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CourtDiagnosticSnapshots",
                        principalColumn: "SessionId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourtDiagnosticAnomalies_SessionId",
                table: "CourtDiagnosticAnomalies",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_CourtDiagnosticSnapshots_CourtId",
                table: "CourtDiagnosticSnapshots",
                column: "CourtId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourtDiagnosticAnomalies");

            migrationBuilder.DropTable(
                name: "CourtDiagnosticSnapshots");
        }
    }
}
