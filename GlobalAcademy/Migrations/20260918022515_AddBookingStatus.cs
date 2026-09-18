using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AssociatedBookingId",
                table: "ShadowQueues",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Bookings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_ShadowQueues_AssociatedBookingId",
                table: "ShadowQueues",
                column: "AssociatedBookingId");

            migrationBuilder.AddForeignKey(
                name: "FK_ShadowQueues_Bookings_AssociatedBookingId",
                table: "ShadowQueues",
                column: "AssociatedBookingId",
                principalTable: "Bookings",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ShadowQueues_Bookings_AssociatedBookingId",
                table: "ShadowQueues");

            migrationBuilder.DropIndex(
                name: "IX_ShadowQueues_AssociatedBookingId",
                table: "ShadowQueues");

            migrationBuilder.DropColumn(
                name: "AssociatedBookingId",
                table: "ShadowQueues");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Bookings");
        }
    }
}
