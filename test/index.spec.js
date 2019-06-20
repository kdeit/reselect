// TODO: Add test for React Redux connect function

import {
  createSelector,
  createSelectorCreator,
  defaultMemoize,
  createStructuredSelector
} from "../src/index";
import * as lodashMemoize from "lodash.memoize";

// Construct 1E6 states for perf test outside of the perf test so as to not change the execute time of the test function
const numOfStates = 1000000;
const states = [];

for (let i = 0; i < numOfStates; i++) {
  states.push({ a: 1, b: 2 });
}

describe("selector", () => {
  test("basic selector", () => {
    const selector = createSelector(
      [state => state.a],
      a => a
    );
    const firstState = { a: 1 };
    const firstStateNewPointer = { a: 1 };
    const secondState = { a: 2 };

    expect(selector(firstState)).toBe(1);
    expect(selector(firstState)).toBe(1);
    expect(selector.recomputations()).toBe(1);
    expect(selector(firstStateNewPointer)).toBe(1);
    expect(selector.recomputations()).toBe(1);
    expect(selector(secondState)).toBe(2);
    expect(selector.recomputations()).toBe(2);
  });

  test("don't pass extra parameters to inputSelector when only called with the state", () => {
    const selector = createSelector(
      [(...params) => params.length],
      a => a
    );
    expect(selector({})).toBe(1);
  });

  test("basic selector multiple keys", () => {
    const selector = createSelector(
      [state => state.a, state => state.b],
      (a, b) => a + b
    );
    const state1 = { a: 1, b: 2 };
    expect(selector(state1)).toBe(3);
    expect(selector(state1)).toBe(3);
    expect(selector.recomputations()).toBe(1);
    const state2 = { a: 3, b: 2 };
    expect(selector(state2)).toBe(5);
    expect(selector(state2)).toBe(5);
    expect(selector.recomputations()).toBe(2);
  });

  test("basic selector invalid input selector", () => {
    expect(() =>
      createSelector(
        [state => state.a, "not a function"],
        (a, b) => a + b
      )
    ).toThrow(/input-selectors to be functions.*function, string/);
  });

  test("1,000,000 calls with the same args to take less than 1 second", () => {
    if (process.env.COVERAGE) {
      return; // don't run performance tests for coverage
    }

    const selector = createSelector(
      [state => state.a, state => state.b],
      (a, b) => a + b
    );
    const state1 = { a: 1, b: 2 };

    const start = new Date();
    for (let i = 0; i < 1000000; i++) {
      selector(state1);
    }
    const totalTime = new Date() - start;

    expect(selector(state1)).toBe(3);
    expect(selector.recomputations()).toBe(1);

    expect(totalTime).toBeLessThan(1000);
  });

  test("1,000,000 calls with shallow state changes to take less than 1 second", () => {
    if (process.env.COVERAGE) {
      return; // don't run performance tests for coverage
    }

    const selector = createSelector(
      [state => state.a, state => state.b],
      (a, b) => a + b
    );

    const start = new Date();
    for (let i = 0; i < numOfStates; i++) {
      selector(states[i]);
    }
    const totalTime = new Date() - start;

    expect(selector(states[0])).toBe(3);
    expect(selector.recomputations()).toBe(1);
    expect(totalTime).toBeLessThan(1000);
  });

  test("memoized composite arguments", () => {
    const selector = createSelector(
      [state => state.sub],
      sub => sub
    );
    const state1 = { sub: { a: 1 } };
    expect(selector(state1)).toEqual({ a: 1 });
    expect(selector(state1)).toEqual({ a: 1 });
    expect(selector.recomputations()).toBe(1);
    const state2 = { sub: { a: 2 } };
    expect(selector(state2)).toEqual({ a: 2 });
    expect(selector.recomputations()).toEqual(2);
  });

  test("can accept props", () => {
    let called = 0;
    const selector = createSelector(
      [state => state.a, state => state.b, (state, props) => props.c],
      (a, b, c) => {
        called++;
        return a + b + c;
      }
    );
    expect(selector({ a: 1, b: 2 }, { c: 100 })).toBe(103);
  });

  test("recomputes result after exception", () => {
    let called = 0;
    const selector = createSelector(
      [state => state.a],
      () => {
        called++;
        throw Error("test error");
      }
    );
    expect(() => selector({ a: 1 })).toThrow("test error");
    expect(() => selector({ a: 1 })).toThrow("test error");
    expect(called).toBe(2);
  });

  test("memoizes previous result before exception", () => {
    let called = 0;
    const selector = createSelector(
      [state => state.a],
      a => {
        called++;
        if (a > 1) throw Error("test error");
        return a;
      }
    );
    const state1 = { a: 1 };
    const state2 = { a: 2 };
    expect(selector(state1)).toBe(1);
    expect(() => selector(state2)).toThrow("test error");
    expect(selector(state1)).toBe(1);
    expect(called).toBe(2);
  });

  test("chained selector", () => {
    const selector1 = createSelector(
      [state => state.sub],
      sub => sub
    );
    const selector2 = createSelector(
      [selector1],
      sub => sub.value
    );
    const state1 = { sub: { value: 1 } };
    expect(selector2(state1)).toBe(1);
    expect(selector2(state1)).toBe(1);
    expect(selector2.recomputations()).toBe(1);
    const state2 = { sub: { value: 2 } };
    expect(selector2(state2)).toBe(2);
    expect(selector2.recomputations()).toBe(2);
  });

  test("chained selector with props", () => {
    const selector1 = createSelector(
      [state => state.sub, (state, props) => props.x],
      (sub, x) => ({ sub, x })
    );
    const selector2 = createSelector(
      [selector1, (state, props) => props.y],
      (param, y) => param.sub.value + param.x + y
    );
    const state1 = { sub: { value: 1 } };
    expect(selector2(state1, { x: 100, y: 200 })).toBe(301);
    expect(selector2(state1, { x: 100, y: 200 })).toBe(301);
    expect(selector2.recomputations()).toBe(1);
    const state2 = { sub: { value: 2 } };
    expect(selector2(state2, { x: 100, y: 201 })).toBe(303);
    expect(selector2.recomputations()).toBe(2);
  });

  test("chained selector with variadic args", () => {
    const selector1 = createSelector(
      [state => state.sub, (state, props, another) => props.x + another],
      (sub, x) => ({ sub, x })
    );
    const selector2 = createSelector(
      [selector1, (state, props) => props.y],
      (param, y) => param.sub.value + param.x + y
    );
    const state1 = { sub: { value: 1 } };
    expect(selector2(state1, { x: 100, y: 200 }, 100)).toBe(401);
    expect(selector2(state1, { x: 100, y: 200 }, 100)).toBe(401);
    expect(selector2.recomputations()).toBe(1);
    const state2 = { sub: { value: 2 } };
    expect(selector2(state2, { x: 100, y: 201 }, 200)).toBe(503);
    expect(selector2.recomputations()).toBe(2);
  });

  test("override valueEquals", () => {
    // a rather absurd valueEquals operation we can verify in tests
    const createOverriddenSelector = createSelectorCreator(
      defaultMemoize,
      (a, b) => typeof a === typeof b
    );
    const selector = createOverriddenSelector([state => state.a], a => a);
    expect(selector({ a: 1 })).toBe(1);
    expect(selector({ a: 2 })).toBe(1); // yes, really true
    expect(selector.recomputations()).toBe(1);
    expect(selector({ a: "A" })).toBe("A");
    expect(selector.recomputations()).toBe(2);
  });

  test("custom memoize", () => {
    const hashFn = (...args) =>
      args.reduce((acc, val) => acc + "-" + JSON.stringify(val));
    const customSelectorCreator = createSelectorCreator(lodashMemoize, hashFn);
    const selector = customSelectorCreator(
      [state => state.a, state => state.b],
      (a, b) => a + b
    );
    expect(selector({ a: 1, b: 2 })).toBe(3);
    expect(selector({ a: 1, b: 2 })).toBe(3);
    expect(selector.recomputations()).toBe(1);
    expect(selector({ a: 1, b: 3 })).toBe(4);
    expect(selector.recomputations()).toBe(2);
    expect(selector({ a: 1, b: 3 })).toBe(4);
    expect(selector.recomputations()).toBe(2);
    expect(selector({ a: 2, b: 3 })).toBe(5);
    expect(selector.recomputations()).toBe(3);
    // TODO: Check correct memoize function was called
  });

  test("exported memoize", () => {
    let called = 0;
    const memoized = defaultMemoize(state => {
      called++;
      return state.a;
    });

    const o1 = { a: 1 };
    const o2 = { a: 2 };
    expect(memoized(o1)).toBe(1);
    expect(memoized(o1)).toBe(1);
    expect(called).toBe(1);
    expect(memoized(o2)).toBe(2);
    expect(called).toBe(2);
  });

  test("exported memoize with multiple arguments", () => {
    const memoized = defaultMemoize((...args) =>
      args.reduce((sum, value) => sum + value, 0)
    );
    expect(memoized(1, 2)).toBe(3);
    expect(memoized(1)).toBe(1);
  });

  test("exported memoize with valueEquals override", () => {
    // a rather absurd toBes operation we can verify in tests
    let called = 0;
    const valueEquals = (a, b) => typeof a === typeof b;
    const memoized = defaultMemoize(a => {
      called++;
      return a;
    }, valueEquals);
    expect(memoized(1)).toBe(1);
    expect(memoized(2)).toBe(1); // yes, really true
    expect(called).toBe(1);
    expect(memoized("A")).toBe("A");
    expect(called).toBe(2);
  });

  test("exported memoize passes correct objects to equalityCheck", () => {
    let fallthroughs = 0;
    function shallowtoBe(newVal, oldVal) {
      if (newVal === oldVal) return true;

      fallthroughs += 1; // code below is expensive and should be bypassed when possible

      let countA = 0;
      let countB = 0;
      for (let key in newVal) {
        if (
          Object.hasOwnProperty.call(newVal, key) &&
          newVal[key] !== oldVal[key]
        )
          return false;
        countA++;
      }
      for (let key in oldVal) {
        if (Object.hasOwnProperty.call(oldVal, key)) countB++;
      }
      return countA === countB;
    }

    const someObject = { foo: "bar" };
    const anotherObject = { foo: "bar" };
    const memoized = defaultMemoize(a => a, shallowtoBe);

    // the first call to `memoized` doesn't hit because `defaultMemoize.lastArgs` is uninitialized
    // and so `equalityCheck` is never called
    memoized(someObject);
    expect(fallthroughs).toBe(0);

    // the next call, with a different object reference, does fall through
    memoized(anotherObject);
    expect(fallthroughs).toBe(1);

    // the third call does not fall through because `defaultMemoize` passes `anotherObject` as
    // both the `newVal` and `oldVal` params. This allows `shallowtoBe` to be much more performant
    // than if it had passed `someObject` as `oldVal`, even though `someObject` and `anotherObject`
    // are shallowly toBe
    memoized(anotherObject);
    expect(fallthroughs).toBe(1);
  });

  test("structured selector", () => {
    const selector = createStructuredSelector({
      x: state => state.a,
      y: state => state.b
    });
    const firstResult = selector({ a: 1, b: 2 });
    expect(firstResult).toEqual({ x: 1, y: 2 });
    expect(selector({ a: 1, b: 2 })).toBe(firstResult);
    const secondResult = selector({ a: 2, b: 2 });
    expect(secondResult).toEqual({ x: 2, y: 2 });
    expect(selector({ a: 2, b: 2 })).toBe(secondResult);
  });

  test("structured selector with invalid arguments", () => {
    expect(() =>
      createStructuredSelector(state => state.a, state => state.b)
    ).toThrow(/expects first argument to be an object.*function/);
    expect(() =>
      createStructuredSelector({
        a: state => state.b,
        c: "d"
      })
    ).toThrow(/input-selectors to be functions.*function, string/);
    expect(() => createStructuredSelector({})).toThrow(/empty object/);
  });

  test("structured selector with custom selector creator", () => {
    const customSelectorCreator = createSelectorCreator(
      defaultMemoize,
      (a, b) => a === b
    );
    const selector = createStructuredSelector(
      {
        x: state => state.a,
        y: state => state.b
      },
      customSelectorCreator
    );
    const firstResult = selector({ a: 1, b: 2 });
    expect(firstResult).toEqual({ x: 1, y: 2 });
    expect(selector({ a: 1, b: 2 })).toBe(firstResult);
    expect(selector({ a: 2, b: 2 })).toEqual({ x: 2, y: 2 });
  });

  test("resetRecomputations", () => {
    const selector = createSelector(
      [state => state.a],
      a => a
    );
    expect(selector({ a: 1 })).toBe(1);
    expect(selector({ a: 1 })).toBe(1);
    expect(selector.recomputations()).toBe(1);
    expect(selector({ a: 2 })).toBe(2);
    expect(selector.recomputations()).toBe(2);

    selector.resetRecomputations();
    expect(selector.recomputations()).toBe(0);

    expect(selector({ a: 1 })).toBe(1);
    expect(selector({ a: 1 })).toBe(1);
    expect(selector.recomputations()).toBe(1);
    expect(selector({ a: 2 })).toBe(2);
    expect(selector.recomputations()).toBe(2);
  });

  test("export last function as resultFunc", () => {
    const lastFunction = () => {};
    const selector = createSelector(
      [state => state.a],
      lastFunction
    );
    expect(selector.resultFunc).toBe(lastFunction);
  });

  test("export dependencies as dependencies", () => {
    const dependency1 = state => {
      state.a;
    };
    const dependency2 = state => {
      state.a;
    };

    const selector = createSelector(
      [dependency1, dependency2],
      () => {}
    );
    expect(selector.dependencies).toEqual([dependency1, dependency2]);
  });
});