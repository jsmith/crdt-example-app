import murmurhash from "murmurhash";

type TODO = any;

var config = {
  // Maximum physical clock drift allowed, in ms
  maxDrift: 60000,
};

export class Timestamp {
  protected _state: { millis: number; counter: number; node: string };

  constructor(millis: number, counter: number, node: string) {
    this._state = {
      millis: millis,
      counter: counter,
      node: node,
    };
  }

  // Timestamp generator initialization
  // * sets the node ID to an arbitrary value
  // * useful for mocking/unit testing
  static init(options: TODO) {
    if (options.maxDrift) {
      config.maxDrift = options.maxDrift;
    }
  }

  /**
   * Timestamp send. Generates a unique, monotonic timestamp suitable
   * for transmission to another system in string format
   */
  static send(clock: TODO) {
    // Retrieve the local wall time
    var phys = Date.now();

    // Unpack the clock.timestamp logical time and counter
    var lOld = clock.timestamp.millis();
    var cOld = clock.timestamp.counter();

    // Calculate the next logical time and counter
    // * ensure that the logical time never goes backward
    // * increment the counter if phys time does not advance
    var lNew = Math.max(lOld, phys);
    var cNew = lOld === lNew ? cOld + 1 : 0;

    // Check the result for drift and counter overflow
    if (lNew - phys > config.maxDrift) {
      throw new ClockDriftError(lNew, phys, config.maxDrift);
    }
    if (cNew > 65535) {
      throw new OverflowError();
    }

    // Repack the logical time/counter
    clock.timestamp.setMillis(lNew);
    clock.timestamp.setCounter(cNew);

    return new Timestamp(
      clock.timestamp.millis(),
      clock.timestamp.counter(),
      clock.timestamp.node()
    );
  }

  // system with the local timeglobal uniqueness and monotonicity are
  // preserved
  static recv(clock: TODO, msg: Timestamp) {
    var phys = Date.now();

    // Unpack the message wall time/counter
    var lMsg = msg.millis();
    var cMsg = msg.counter();

    // Assert the node id and remote clock drift
    if (msg.node() === clock.timestamp.node()) {
      throw new DuplicateNodeError(clock.timestamp.node());
    }
    if (lMsg - phys > config.maxDrift) {
      throw new ClockDriftError();
    }

    // Unpack the clock.timestamp logical time and counter
    var lOld = clock.timestamp.millis();
    var cOld = clock.timestamp.counter();

    // Calculate the next logical time and counter.
    // Ensure that the logical time never goes backward;
    // * if all logical clocks are equal, increment the max counter,
    // * if max = old > message, increment local counter,
    // * if max = messsage > old, increment message counter,
    // * otherwise, clocks are monotonic, reset counter
    var lNew = Math.max(Math.max(lOld, phys), lMsg);
    var cNew =
      lNew === lOld && lNew === lMsg
        ? Math.max(cOld, cMsg) + 1
        : lNew === lOld
        ? cOld + 1
        : lNew === lMsg
        ? cMsg + 1
        : 0;

    // Check the result for drift and counter overflow
    if (lNew - phys > config.maxDrift) {
      throw new ClockDriftError();
    }
    if (cNew > 65535) {
      throw new OverflowError();
    }

    // Repack the logical time/counter
    clock.timestamp.setMillis(lNew);
    clock.timestamp.setCounter(cNew);

    return new Timestamp(
      clock.timestamp.millis(),
      clock.timestamp.counter(),
      clock.timestamp.node()
    );
  }

  /**
   * Converts a fixed-length string timestamp to the structured value
   */
  static parse(timestamp: string) {
    var parts = timestamp.split("-");
    if (parts && parts.length === 5) {
      var millis = Date.parse(parts.slice(0, 3).join("-")).valueOf();
      var counter = parseInt(parts[3], 16);
      var node = parts[4];
      if (!isNaN(millis) && !isNaN(counter))
        return new Timestamp(millis, counter, node);
      else throw Error("Invalid timestamp: " + timestamp);
    } else {
      throw Error("Invalid timestamp: " + timestamp);
    }
  }

  static since(isoString: string) {
    return isoString + "-0000-0000000000000000";
  }

  valueOf() {
    return this.toString();
  }

  toString() {
    return [
      new Date(this.millis()).toISOString(),
      ("0000" + this.counter().toString(16).toUpperCase()).slice(-4),
      ("0000000000000000" + this.node()).slice(-16),
    ].join("-");
  }

  millis() {
    return this._state.millis;
  }

  counter() {
    return this._state.counter;
  }

  node() {
    return this._state.node;
  }

  hash() {
    return murmurhash.v3(this.toString());
  }
}

export class MutableTimestamp extends Timestamp {
  static from(timestamp: Timestamp) {
    return new MutableTimestamp(
      timestamp.millis(),
      timestamp.counter(),
      timestamp.node()
    );
  }

  setMillis(n: number) {
    this._state.millis = n;
  }

  setCounter(n: number) {
    this._state.counter = n;
  }

  setNode(n: string) {
    this._state.node = n;
  }
}

export const DuplicateNodeError = class extends Error {
  constructor(node: TODO) {
    super();
    (this as any).type = "DuplicateNodeError";
    this.message = "duplicate node identifier " + node;
  }
};

export const ClockDriftError = class extends Error {
  constructor(...args: TODO) {
    super();
    (this as any).type = "ClockDriftError";
    this.message = ["maximum clock drift exceeded"].concat(args).join(" ");
  }
};

export const OverflowError = class extends Error {
  constructor() {
    super();
    (this as any).type = "OverflowError";
    this.message = "timestamp counter overflow";
  }
};
