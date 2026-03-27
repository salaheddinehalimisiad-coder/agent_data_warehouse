
import sys
import os
import json
import math
from fpdf import FPDF

# Mock state
logical_model = {
    "tables": [
        {
            "name": "fact_ventes",
            "type": "FAIT",
            "columns": [
                {"name": "id", "type": "BIGINT", "is_primary_key": True},
                {"name": "dim_produit_sk", "type": "BIGINT", "is_foreign_key": True, "references": "dim_produit"},
                {"name": "dim_date_sk", "type": "BIGINT", "is_foreign_key": True, "references": "dim_date"},
                {"name": "montant", "type": "DECIMAL"}
            ]
        },
        {
            "name": "dim_produit",
            "type": "DIMENSION",
            "columns": [
                {"name": "produit_sk", "type": "BIGINT", "is_primary_key": True},
                {"name": "nom", "type": "VARCHAR(255)"}
            ]
        },
        {
            "name": "dim_date",
            "type": "DIMENSION",
            "columns": [
                {"name": "date_sk", "type": "BIGINT", "is_primary_key": True},
                {"name": "jour", "type": "INT"}
            ]
        }
    ]
}

def test_draw():
    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.add_page()
    
    # Header
    pdf.set_fill_color(15, 15, 20)
    pdf.rect(0, 0, 297, 40, 'F')
    pdf.set_font("Arial", 'B', 24)
    pdf.set_text_color(255, 255, 255)
    pdf.text(20, 25, "DATA WAREHOUSE SCHEMA")
    
    tables = logical_model['tables']
    fact_tables = [t for t in tables if t.get('type') == 'FAIT']
    dim_tables = [t for t in tables if t.get('type') != 'FAIT']
    
    table_coords = {}
    center_x, center_y = 148, 120
    
    def draw_table_box(t, x, y):
        w = 55
        h_header = 8
        h_row = 5
        num_cols = len(t.get('columns', []))
        total_h = h_header + (num_cols * h_row) + 2
        pdf.set_fill_color(240, 240, 240)
        pdf.rect(x+1, y+1, w, total_h, 'F')
        is_fact = t.get('type') == 'FAIT'
        if is_fact: pdf.set_fill_color(99, 102, 241)
        else: pdf.set_fill_color(20, 184, 166)
        pdf.rect(x, y, w, total_h, 'D')
        pdf.rect(x, y, w, h_header, 'F')
        pdf.set_font("Arial", 'B', 9)
        pdf.set_text_color(255, 255, 255)
        pdf.text(x + 5, y + 5.5, t['name'].upper())
        pdf.set_font("Arial", '', 8)
        pdf.set_text_color(50, 50, 50)
        curr_y = y + h_header + 4
        for col in t.get('columns', []):
            name = col['name']
            if col.get('is_primary_key'): name = "[PK] " + name
            if col.get('is_foreign_key'): name = "[FK] " + name
            pdf.text(x + 4, curr_y, name)
            curr_y += h_row
        return w, total_h

    for i, ft in enumerate(fact_tables):
        fx, fy = center_x - 27, center_y - 20
        draw_table_box(ft, fx, fy)
        table_coords[ft['name']] = (fx, fy, 55, 10 + len(ft['columns'])*5)

    radius = 80
    for i, dt in enumerate(dim_tables):
        angle = (i / len(dim_tables)) * 2 * math.pi
        dx, dy = center_x + radius * math.cos(angle) - 27, center_y + radius * math.sin(angle) - 20
        draw_table_box(dt, dx, dy)
        table_coords[dt['name']] = (dx, dy, 55, 10 + len(dt['columns'])*5)

    pdf.output("test_mcd.pdf")
    print("PDF generated successfully: test_mcd.pdf")

if __name__ == "__main__":
    test_draw()
