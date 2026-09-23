using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AppendLangGraphStateCheckpointerTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GraphStateCheckpoints",
                columns: table => new
                {
                    ThreadId = table.Column<Guid>(type: "uuid", nullable: false),
                    CheckpointId = table.Column<Guid>(type: "uuid", nullable: false),
                    AcademyId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ActiveNode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SerializedState = table.Column<string>(type: "text", nullable: false),
                    ContextTokenCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GraphStateCheckpoints", x => new { x.ThreadId, x.CheckpointId });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GraphStateCheckpoints");
        }
    }
}
