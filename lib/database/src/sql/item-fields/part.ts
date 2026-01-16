import * as Dict from "@mobily/ts-belt/Dict";
import type betterSqlite3 from "better-sqlite3";
import type { IDLibID } from "../../utils/index.js";
import { PreparedBase } from "../../utils/index.js";
import type { Output as OutputSql } from "./base.js";
import { sql } from "./base.js";

const query = sql(false);

interface Input {
  libId: number;
  itemId: number;
}

type Output = Record<number, OutputSql[]>;

export class ItemFields extends PreparedBase<Input, OutputSql, Output> {
  trxFunc = (itemIds: IDLibID[]) =>
    itemIds.map(
      ([itemId, libId]) => [itemId, this.all({ itemId, libId })] as const,
    );
  trx: betterSqlite3.Transaction = this.database.transaction(this.trxFunc);

  sql(): string {
    return query;
  }

  query(items: IDLibID[]): Output {
    return Dict.fromPairs((this.trx as ItemFields["trxFunc"])(items));
  }
}
