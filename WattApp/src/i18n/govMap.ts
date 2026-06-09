export const GOV_EN: Record<string, string> = {
  'مسقط': 'Muscat',
  'الداخلية': 'Ad Dakhiliyah',
  'الباطنة الشمالية': 'North Al Batinah',
  'الباطنة الجنوبية': 'South Al Batinah',
  'الشرقية الشمالية': 'North Al Sharqiyah',
  'الشرقية الجنوبية': 'South Al Sharqiyah',
  'الظاهرة': 'Al Dhahirah',
  'الوسطى': 'Al Wusta',
  'مسندم': 'Musandam',
  'البريمي': 'Al Buraimi',
  'ظفار': 'Dhofar',
};

export function translateGov(gov: string, isRTL: boolean): string {
  if (isRTL) return gov;
  return GOV_EN[gov] ?? gov;
}

export function stationDisplayName(station: { name: string; name_ar?: string | null }, isRTL: boolean): string {
  return isRTL ? (station.name_ar || station.name) : station.name;
}

export function stationDisplayAddress(station: { address: string; address_ar?: string | null }, isRTL: boolean): string {
  return isRTL ? (station.address_ar || station.address) : station.address;
}
