import { map } from "@mobily/ts-belt/Dict";
import { debounce } from "@mobily/ts-belt/Function";

export abstract class Debouncer<Data, ID> {
  #queue = new Map<ID, Data>();

  request(id: ID, data: Data): void {
    this.#queue.set(id, data);
    this.#request();
  }

  abstract notify(data: [ID, Data][]): Promise<void> | void;

  #request = debounce(async () => {
    if (this.#queue.size === 0) return;
    const task = this.notify(Array.from(this.#queue.entries()));
    this.#queue.clear();
    // capture error
    await task;
  }, 500);

  static create<Data, ID>(
    notify: (data: [ID, Data][]) => Promise<void> | void,
  ): Debouncer<Data, ID>["request"] {
    const debouncer = new (class extends Debouncer<Data, ID> {
      notify = notify;
    })();
    return debouncer.request.bind(debouncer);
  }
}

export abstract class ItemUpdateDebouncer {
  queue = {
    add: new Map<number, [lib: number, key: string]>(),
    modify: new Map<number, [lib: number, key: string]>(),
    trash: new Map<number, [lib: number, key: string]>(),
  };

  request(
    id: number,
    lib: number,
    key: string,
    type: keyof ItemUpdateDebouncer["queue"],
  ): void {
    this.queue[type].set(id, [lib, key]);
    this.#request();
  }

  abstract notify(data: {
    [K in keyof ItemUpdateDebouncer["queue"]]: [number, number, string][];
  }): Promise<void> | void;

  #request = debounce(async () => {
    await this.notify(
      map(this.queue, (map) => {
        const data = Array.from(map.entries()).map(
          ([id, [lib, key]]) => [id, lib, key] as [number, number, string],
        );
        map.clear();
        return data;
      }),
    );
  }, 500);

  static create(
    notify: ItemUpdateDebouncer["notify"],
  ): ItemUpdateDebouncer["request"] {
    const debouncer = new (class extends ItemUpdateDebouncer {
      notify = notify;
    })();
    return debouncer.request.bind(debouncer);
  }
}
