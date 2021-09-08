import { IElementScope } from "../Skope";


export function walkerInstance() {
  const execSteps: ((scopes: IElementScope[]) => void)[] = [];
  return {
    ready: (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb),
    run: function runNested(scopes: IElementScope[]) {
      execSteps.forEach((cb) => cb(scopes));
      execSteps.length = 0;
    }
  }
}
