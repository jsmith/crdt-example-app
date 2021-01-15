import { Data, DataKeys, Message, _data, _messages } from "./db";
import { Timestamp } from "./shared/timestamp";
import * as merkle from "./shared/merkle";
import { getClock, makeClientId, makeClock, setClock } from "./clock";
import { SERVER_URL } from "./env";

setClock(makeClock(new Timestamp(0, 0, makeClientId())));

type TODO = any;

let _onSync: (() => void) | null = null;
let _syncEnabled = true;

export function setSyncingEnabled(flag: boolean) {
  _syncEnabled = flag;
}

async function post(data: TODO) {
  let res = await fetch(`${SERVER_URL}/sync`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();

  if (json.status !== "ok") {
    throw new Error("API error: " + json.reason);
  }

  return json.data;
}

function apply<K extends DataKeys, C extends Data[K] & string>(
  msg: Message<K, C>
) {
  let table: Array<{ id: string }> = _data[msg.dataset];
  if (!table) {
    throw new Error("Unknown dataset: " + msg.dataset);
  }

  let row = table.find((row) => row.id === msg.row);
  if (!row) {
    table.push({ id: msg.row, [msg.column]: msg.value });
  } else {
    (row as any)[msg.column] = msg.value;
  }
}

function compareMessages(messages: Message<any, any>[]) {
  let existingMessages = new Map();

  // This could be optimized, but keeping it simple for now. Need to
  // find the latest message that exists for the dataset/row/column
  // for each incoming message, so sort it first

  let sortedMessages = [..._messages].sort((m1, m2) => {
    if (m1.timestamp < m2.timestamp) {
      return 1;
    } else if (m1.timestamp > m2.timestamp) {
      return -1;
    }
    return 0;
  });

  messages.forEach((msg1) => {
    let existingMsg = sortedMessages.find(
      (msg2) =>
        msg1.dataset === msg2.dataset &&
        msg1.row === msg2.row &&
        msg1.column === msg2.column
    );

    existingMessages.set(msg1, existingMsg);
  });

  return existingMessages;
}

function applyMessages(messages: Message[]) {
  let existingMessages = compareMessages(messages);
  let clock = getClock();

  messages.forEach((msg) => {
    if (!clock) throw Error("Clock needs to be set first");

    let existingMsg = existingMessages.get(msg);

    if (!existingMsg || existingMsg.timestamp < msg.timestamp) {
      apply(msg);
    }

    if (!existingMsg || existingMsg.timestamp !== msg.timestamp) {
      clock.merkle = merkle.insert(
        clock.merkle,
        Timestamp.parse(msg.timestamp)
      );
      _messages.push(msg);
    }
  });

  _onSync && _onSync();
}

export function sendMessages(messages: Message[]) {
  applyMessages(messages);
  sync(messages);
}

function receiveMessages(messages: Message[]) {
  messages.forEach((msg) =>
    Timestamp.recv(getClock(), Timestamp.parse(msg.timestamp))
  );

  applyMessages(messages);
}

export function onSync(func: () => void) {
  _onSync = func;
}

export async function sync(
  initialMessages: Message[] = [],
  since: number | null = null
): Promise<void> {
  if (!_syncEnabled) {
    return;
  }

  let messages = initialMessages;

  if (since) {
    let timestamp = new Timestamp(since, 0, "0").toString();
    messages = _messages.filter((msg) => msg.timestamp >= timestamp);
  }

  let result;
  try {
    result = await post({
      group_id: "my-group",
      client_id: getClock().timestamp.node(),
      messages,
      merkle: getClock().merkle,
    });
  } catch (e) {
    throw new Error("network-failure");
  }

  if (result.messages.length > 0) {
    receiveMessages(result.messages);
  }

  let diffTime = merkle.diff(result.merkle, getClock().merkle);

  if (diffTime) {
    if (since && since === diffTime) {
      throw new Error(
        "A bug happened while syncing and the client " +
          "was unable to get in sync with the server. " +
          "This is an internal error that shouldn't happen"
      );
    }

    await sync([], diffTime);
  }
}
