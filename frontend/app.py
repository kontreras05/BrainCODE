import flet as ft
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "metrics.db")

def main(page: ft.Page):
    page.title = "BrainCODE Dashboard"
    page.theme_mode = ft.ThemeMode.DARK
    page.padding = 40
    page.window_width = 900
    page.window_height = 700
    
    # Paleta de colores atractiva
    PRIMARY_COLOR = "#6C63FF"
    BG_COLOR = "#0F1015"
    CARD_BG = "#1A1B23"
    ACCENT_COLOR = "#FF6584"
    
    page.bgcolor = BG_COLOR
    
    # Animaciones
    page.update()
    
    header = ft.Text(
        "🧠 BrainCODE Analytics",
        size=36,
        weight=ft.FontWeight.BOLD,
        color=PRIMARY_COLOR,
    )
    
    subtitle = ft.Text(
        "Monitorea tu productividad y concentración en tiempo real.",
        size=16,
        color=ft.colors.WHITE70,
        italic=True
    )
    
    stats_text = ft.Text("Calculando métricas...", size=28, weight=ft.FontWeight.BOLD, color=ACCENT_COLOR)
    
    stats_card = ft.Container(
        content=ft.Column([
            ft.Text("Tiempo en Redes Sociales (Hoy)", size=18, weight=ft.FontWeight.W_500, color=ft.colors.WHITE),
            ft.Divider(color=ft.colors.TRANSPARENT, height=10),
            stats_text
        ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER),
        bgcolor=CARD_BG,
        padding=30,
        border_radius=20,
        shadow=ft.BoxShadow(spread_radius=2, blur_radius=15, color=ft.colors.BLACK45, offset=ft.Offset(0, 5)),
        width=400,
        alignment=ft.alignment.center
    )

    def load_stats(e=None):
        try:
            if not os.path.exists(DB_PATH):
                stats_text.value = "Esperando datos..."
                page.update()
                return

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT SUM(duration_seconds) FROM window_metrics WHERE category='Social Media'")
            result = cursor.fetchone()[0]
            conn.close()
            
            if result:
                minutes = result // 60
                seconds = result % 60
                if minutes > 0:
                    stats_text.value = f"{minutes} min {seconds} sec"
                else:
                    stats_text.value = f"{seconds} sec"
            else:
                stats_text.value = "0 sec (¡Perfecto!)"
        except Exception as err:
            stats_text.value = "Error al leer DB"
            
        page.update()

    refresh_btn = ft.ElevatedButton(
        "Actualizar Métricas",
        icon=ft.icons.REFRESH,
        color=ft.colors.WHITE,
        bgcolor=PRIMARY_COLOR,
        on_click=load_stats,
        style=ft.ButtonStyle(
            shape=ft.RoundedRectangleBorder(radius=10),
            padding=ft.padding.all(15)
        )
    )

    page.add(
        ft.Column([
            header,
            subtitle,
            ft.Divider(height=40, color=ft.colors.TRANSPARENT),
            stats_card,
            ft.Divider(height=30, color=ft.colors.TRANSPARENT),
            refresh_btn
        ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, alignment=ft.MainAxisAlignment.CENTER)
    )
    
    load_stats()

if __name__ == "__main__":
    ft.app(target=main)
