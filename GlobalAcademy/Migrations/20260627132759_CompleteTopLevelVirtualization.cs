using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class CompleteTopLevelVirtualization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "Courts",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "Branches",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "Academy",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Academy", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Courts_BranchId",
                table: "Courts",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Branches_AcademyId",
                table: "Branches",
                column: "AcademyId");

            migrationBuilder.AddForeignKey(
                name: "FK_Branches_Academy_AcademyId",
                table: "Branches",
                column: "AcademyId",
                principalTable: "Academy",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Courts_Branches_BranchId",
                table: "Courts",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Branches_Academy_AcademyId",
                table: "Branches");

            migrationBuilder.DropForeignKey(
                name: "FK_Courts_Branches_BranchId",
                table: "Courts");

            migrationBuilder.DropTable(
                name: "Academy");

            migrationBuilder.DropIndex(
                name: "IX_Courts_BranchId",
                table: "Courts");

            migrationBuilder.DropIndex(
                name: "IX_Branches_AcademyId",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "Courts");

            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "Branches");
        }
    }
}
