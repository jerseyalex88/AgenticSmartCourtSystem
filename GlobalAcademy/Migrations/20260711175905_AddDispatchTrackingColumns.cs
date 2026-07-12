using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddDispatchTrackingColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DispatchStatus",
                table: "ShadowQueues",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PlayerPhoneNumber",
                table: "ShadowQueues",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ProposedSlotId",
                table: "ShadowQueues",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "Bookings",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "DurationInMinutes",
                table: "Bookings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "PricePaid",
                table: "Bookings",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DispatchStatus",
                table: "ShadowQueues");

            migrationBuilder.DropColumn(
                name: "PlayerPhoneNumber",
                table: "ShadowQueues");

            migrationBuilder.DropColumn(
                name: "ProposedSlotId",
                table: "ShadowQueues");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "DurationInMinutes",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PricePaid",
                table: "Bookings");
        }
    }
}
