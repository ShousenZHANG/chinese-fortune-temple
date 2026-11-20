// The Skill's city table (assets/cities_cn.json), served by the build from the verified archive.
export interface City {
  name: string;
  province: string;
  lon: number;
  tz: string;
  aliases: string[];
}

let table: Promise<Map<string, City>> | null = null;

export function cities(): Promise<Map<string, City>> {
  table ??= fetch(`${import.meta.env.BASE_URL}skill/cities_cn.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`city table answered ${response.status}`);
      return response.json() as Promise<{ cities: City[] }>;
    })
    .then(({ cities: list }) => new Map(list.map((city) => [city.name, city])))
    .catch((error: unknown) => {
      table = null;
      throw error;
    });
  return table;
}

export const cityFacts = (city: City): string => `${city.name}：东经 ${city.lon}°，时区 ${city.tz}`;
