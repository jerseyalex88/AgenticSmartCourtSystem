using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobalAcademy.Migrations
{
    /// <inheritdoc />
    public partial class ShiftTransactionPointerToInvoice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LedgerTransactions_Invoices_InvoiceId",
                table: "LedgerTransactions");

            migrationBuilder.DropIndex(
                name: "IX_LedgerTransactions_InvoiceId",
                table: "LedgerTransactions");

            migrationBuilder.DropColumn(
                name: "InvoiceId",
                table: "LedgerTransactions");

            migrationBuilder.AddColumn<Guid>(
                name: "AssociatedTransactionId",
                table: "Invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_AssociatedTransactionId",
                table: "Invoices",
                column: "AssociatedTransactionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_LedgerTransactions_AssociatedTransactionId",
                table: "Invoices",
                column: "AssociatedTransactionId",
                principalTable: "LedgerTransactions",
                principalColumn: "TransactionId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_LedgerTransactions_AssociatedTransactionId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_AssociatedTransactionId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "AssociatedTransactionId",
                table: "Invoices");

            migrationBuilder.AddColumn<Guid>(
                name: "InvoiceId",
                table: "LedgerTransactions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_LedgerTransactions_InvoiceId",
                table: "LedgerTransactions",
                column: "InvoiceId");

            migrationBuilder.AddForeignKey(
                name: "FK_LedgerTransactions_Invoices_InvoiceId",
                table: "LedgerTransactions",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "InvoiceId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
