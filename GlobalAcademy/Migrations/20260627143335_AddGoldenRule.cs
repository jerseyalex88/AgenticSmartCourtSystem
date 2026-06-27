using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddGoldenRule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Branches_Academy_AcademyId",
                table: "Branches");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Academy",
                table: "Academy");

            migrationBuilder.RenameTable(
                name: "Academy",
                newName: "Academies");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Academies",
                table: "Academies",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Branches_Academies_AcademyId",
                table: "Branches",
                column: "AcademyId",
                principalTable: "Academies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Branches_Academies_AcademyId",
                table: "Branches");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Academies",
                table: "Academies");

            migrationBuilder.RenameTable(
                name: "Academies",
                newName: "Academy");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Academy",
                table: "Academy",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Branches_Academy_AcademyId",
                table: "Branches",
                column: "AcademyId",
                principalTable: "Academy",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
