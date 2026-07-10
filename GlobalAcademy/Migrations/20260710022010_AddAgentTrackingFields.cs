using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentTrackingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsResolved",
                table: "ShadowQueues",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PlayerName",
                table: "ShadowQueues",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PreferredWindow",
                table: "ShadowQueues",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BookedPlayerName",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CourtName",
                table: "Bookings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsAvailableSlot",
                table: "Bookings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "SlotTime",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsResolved",
                table: "ShadowQueues");

            migrationBuilder.DropColumn(
                name: "PlayerName",
                table: "ShadowQueues");

            migrationBuilder.DropColumn(
                name: "PreferredWindow",
                table: "ShadowQueues");

            migrationBuilder.DropColumn(
                name: "BookedPlayerName",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "CourtName",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "IsAvailableSlot",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "SlotTime",
                table: "Bookings");
        }
    }
}
