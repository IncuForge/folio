use tauri::WebviewWindow;
use windows::Win32::{
  Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
  Graphics::Gdi::ScreenToClient,
  UI::{
    HiDpi::GetDpiForWindow,
    Shell::{DefSubclassProc, SetWindowSubclass},
    WindowsAndMessaging::{GetClientRect, HTMAXBUTTON, WM_NCHITTEST},
  },
};

const SUBCLASS_ID: usize = 0x464f_4c49;
const TITLEBAR_HEIGHT_CSS: i32 = 38;
const WINDOW_CONTROL_WIDTH_CSS: i32 = 46;

pub fn install(window: &WebviewWindow) -> tauri::Result<()> {
  let hwnd = window.hwnd()?;

  // Rendering and clicks stay in the HTML titlebar. This hit-test makes
  // Windows 11 recognize that same maximize button for native Snap Layouts.
  unsafe {
    if !SetWindowSubclass(hwnd, Some(folio_window_subclass), SUBCLASS_ID, 0).as_bool() {
      return Err(std::io::Error::last_os_error().into());
    }
  }

  Ok(())
}

unsafe extern "system" fn folio_window_subclass(
  hwnd: HWND,
  message: u32,
  wparam: WPARAM,
  lparam: LPARAM,
  _subclass_id: usize,
  _reference_data: usize,
) -> LRESULT {
  if message == WM_NCHITTEST {
    let mut point = POINT {
      x: signed_low_word(lparam.0),
      y: signed_high_word(lparam.0),
    };
    let mut client_rect = RECT::default();

    if ScreenToClient(hwnd, &mut point).as_bool()
      && GetClientRect(hwnd, &mut client_rect).is_ok()
      && is_in_maximize_button(
        point.x,
        point.y,
        client_rect.right - client_rect.left,
        GetDpiForWindow(hwnd),
      )
    {
      return LRESULT(HTMAXBUTTON as isize);
    }
  }

  DefSubclassProc(hwnd, message, wparam, lparam)
}

fn signed_low_word(value: isize) -> i32 {
  (value as u16 as i16) as i32
}

fn signed_high_word(value: isize) -> i32 {
  ((value >> 16) as u16 as i16) as i32
}

fn scale_css_pixels(css_pixels: i32, dpi: u32) -> i32 {
  ((css_pixels as i64 * dpi.max(96) as i64 + 48) / 96) as i32
}

fn is_in_maximize_button(x: i32, y: i32, client_width: i32, dpi: u32) -> bool {
  let control_width = scale_css_pixels(WINDOW_CONTROL_WIDTH_CSS, dpi);
  let titlebar_height = scale_css_pixels(TITLEBAR_HEIGHT_CSS, dpi);
  let left = client_width - (control_width * 2);
  let right = client_width - control_width;

  x >= left && x < right && y >= 0 && y < titlebar_height
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn detects_the_maximize_button_at_standard_dpi() {
    assert!(is_in_maximize_button(1360, 20, 1440, 96));
    assert!(!is_in_maximize_button(1310, 20, 1440, 96));
    assert!(!is_in_maximize_button(1410, 20, 1440, 96));
    assert!(!is_in_maximize_button(1360, 45, 1440, 96));
  }

  #[test]
  fn scales_the_hit_target_for_high_dpi_displays() {
    assert!(is_in_maximize_button(1320, 40, 1440, 192));
    assert!(!is_in_maximize_button(1240, 40, 1440, 192));
  }
}
