/** Same shape as the English dictionary, with any string allowed. */
export type Widen<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends readonly string[] ? readonly string[] : Widen<T[K]> };
