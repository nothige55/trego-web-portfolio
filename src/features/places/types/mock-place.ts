export interface MockPlace {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly summary: string;
  readonly address: string;
  readonly hours: string;
  readonly phone: string;
  readonly website: string;
  readonly rating: number;
  readonly reviewCount: number;
  readonly priceLevel: string;
  readonly tags: readonly string[];
}
