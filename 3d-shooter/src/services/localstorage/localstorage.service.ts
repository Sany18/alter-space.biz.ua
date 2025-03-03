export class LocalStorageService {
  private static readonly prefix = '3d-game-';

  static get(key: string): any {
    const item = localStorage.getItem(this.prefix + key);

    if (item) {
      return JSON.parse(item);
    }
    return null;
  }

  static set(key: string, value: any): void {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  static remove(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }
}
