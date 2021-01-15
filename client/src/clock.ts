import { MutableTimestamp, Timestamp } from "./shared/timestamp";
import * as uuid from "uuid";
import type { Trie } from "./shared/merkle";

export type Clock = {
  timestamp: MutableTimestamp;
  merkle: Trie;
};

let _clock: Clock | null = null;

export function setClock(clock: Clock) {
  _clock = clock;
}

export function getClock() {
  return _clock as Clock;
}

export function makeClock(timestamp: Timestamp, merkle = {}) {
  return { timestamp: MutableTimestamp.from(timestamp), merkle };
}

export function makeClientId() {
  return uuid.v4().replace(/-/g, "").slice(-16);
}
