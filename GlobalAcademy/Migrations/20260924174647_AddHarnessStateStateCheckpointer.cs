using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class AddHarnessStateStateCheckpointer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SURGICAL FIX: Force explicit cast using Postgres JSONB parser matrix
            migrationBuilder.Sql(
                "ALTER TABLE \"GraphStateCheckpoints\" ALTER COLUMN \"SerializedState\" TYPE jsonb USING \"SerializedState\"::jsonb;"
            );

            migrationBuilder.AlterColumn<string>(
                name: "CheckpointId",
                table: "GraphStateCheckpoints",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<int>(
                name: "LoopIterationCount",
                table: "GraphStateCheckpoints",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_GraphStateCheckpoints_AcademyId_ThreadId",
                table: "GraphStateCheckpoints",
                columns: new[] { "AcademyId", "ThreadId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GraphStateCheckpoints_AcademyId_ThreadId",
                table: "GraphStateCheckpoints");

            migrationBuilder.DropColumn(
                name: "LoopIterationCount",
                table: "GraphStateCheckpoints");

            // SURGICAL FIX: Revert cast safely back to raw text structure if reversed
            migrationBuilder.Sql(
                "ALTER TABLE \"GraphStateCheckpoints\" ALTER COLUMN \"SerializedState\" TYPE text USING \"SerializedState\"::text;"
            );

            migrationBuilder.AlterColumn<Guid>(
                name: "CheckpointId",
                table: "GraphStateCheckpoints",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255);
        }
    }
}
