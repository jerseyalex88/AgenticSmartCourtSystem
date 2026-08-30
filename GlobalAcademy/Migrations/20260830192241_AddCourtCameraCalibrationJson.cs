using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddCourtCameraCalibrationJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CameraCalibrationJson",
                table: "Courts",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CameraCalibrationJson",
                table: "Courts");
        }
    }
}
