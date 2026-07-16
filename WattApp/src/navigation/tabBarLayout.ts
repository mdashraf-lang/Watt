import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Floating tab bar geometry — shared by the tab bar itself and every screen
// that needs to pad its content so nothing hides behind the floating bar.
export const TAB_BAR_TOP = 8;      // gap above the pill
export const TAB_PILL_HEIGHT = 62; // fixed pill height

// Total space the floating bar occupies from the screen bottom.
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_TOP + TAB_PILL_HEIGHT + Math.max(insets.bottom, 12);
}
