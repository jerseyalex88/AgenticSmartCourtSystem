using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddDecommissionFlagToFacilities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDecommissioned",
                table: "Courts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDecommissioned",
                table: "Branches",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDecommissioned",
                table: "Courts");

            migrationBuilder.DropColumn(
                name: "IsDecommissioned",
                table: "Branches");
        }
    }
}
