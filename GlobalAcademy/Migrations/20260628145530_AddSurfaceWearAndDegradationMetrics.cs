using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddSurfaceWearAndDegradationMetrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AggregateMinutesPlayed",
                table: "Courts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "EstimatedReopenTimeUtc",
                table: "Courts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaintenanceThresholdMinutes",
                table: "Courts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Courts",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AggregateMinutesPlayed",
                table: "Courts");

            migrationBuilder.DropColumn(
                name: "EstimatedReopenTimeUtc",
                table: "Courts");

            migrationBuilder.DropColumn(
                name: "MaintenanceThresholdMinutes",
                table: "Courts");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Courts");
        }
    }
}
