/** VS Code SCM graph constants (scmHistory.ts) */
export const SWIMLANE_WIDTH = 11;
export const SWIMLANE_HEIGHT = 22;
export const SWIMLANE_CURVE_RADIUS = 5;
export const CIRCLE_RADIUS = 4;
export const CIRCLE_STROKE_WIDTH = 2;

export const GRAPH_COLORS = ['#3794ff', '#FFB000', '#DC267F', '#994F00', '#40B0A6', '#B66DFF'];
export const HEAD_COLOR = '#3794ff';

export interface GitGraphCommit {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  author: string;
  date: string;
  refs: string[];
}

export interface SwimlaneNode {
  id: string;
  color: string;
}

export interface GitGraphViewModel {
  commit: GitGraphCommit;
  kind: 'HEAD' | 'node';
  inputSwimlanes: SwimlaneNode[];
  outputSwimlanes: SwimlaneNode[];
}

export function laneX(index: number): number {
  return SWIMLANE_WIDTH * (index + 1);
}

export function graphWidth(inputCount: number, outputCount: number): number {
  return SWIMLANE_WIDTH * (Math.max(inputCount, outputCount, 1) + 1);
}

function findLastIndex(nodes: SwimlaneNode[], id: string): number {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i].id === id) return i;
  }
  return -1;
}

function getLabelColor(commit: GitGraphCommit, colorMap: Map<string, string | undefined>): string | undefined {
  for (const ref of commit.refs) {
    const color = colorMap.get(ref);
    if (color) return color;
  }
  return undefined;
}

function assignRefColors(commit: GitGraphCommit, colorMap: Map<string, string | undefined>, colorIndex: { value: number }): void {
  for (const ref of commit.refs) {
    if (colorMap.has(ref)) continue;
    const existing = commit.refs.map(r => colorMap.get(r)).find(Boolean);
    if (existing) {
      colorMap.set(ref, existing);
    } else if (ref === 'main' || ref.endsWith('/main')) {
      colorMap.set(ref, HEAD_COLOR);
    } else {
      colorIndex.value = (colorIndex.value + 1) % GRAPH_COLORS.length;
      colorMap.set(ref, GRAPH_COLORS[colorIndex.value]);
    }
  }
}

export function toGitGraphViewModels(commits: GitGraphCommit[]): GitGraphViewModel[] {
  const colorMap = new Map<string, string | undefined>();
  const colorIndex = { value: -1 };
  const viewModels: GitGraphViewModel[] = [];

  for (const commit of commits) {
    assignRefColors(commit, colorMap, colorIndex);

    const kind: GitGraphViewModel['kind'] = viewModels.length === 0 ? 'HEAD' : 'node';
    const inputSwimlanes = (viewModels.at(-1)?.outputSwimlanes ?? []).map(node => ({ ...node }));
    const outputSwimlanes: SwimlaneNode[] = [];
    const parentIds = commit.parents;

    let firstParentAdded = false;
    if (parentIds.length > 0) {
      for (const node of inputSwimlanes) {
        if (node.id === commit.hash) {
          if (!firstParentAdded) {
            outputSwimlanes.push({
              id: parentIds[0],
              color: getLabelColor(commit, colorMap) ?? node.color,
            });
            firstParentAdded = true;
          }
          continue;
        }
        outputSwimlanes.push({ ...node });
      }
    }

    for (let i = firstParentAdded ? 1 : 0; i < parentIds.length; i++) {
      let color = i === 0 ? getLabelColor(commit, colorMap) : undefined;
      if (!color) {
        const parentCommit = commits.find(c => c.hash === parentIds[i]);
        color = parentCommit ? getLabelColor(parentCommit, colorMap) : undefined;
      }
      if (!color) {
        colorIndex.value = (colorIndex.value + 1) % GRAPH_COLORS.length;
        color = GRAPH_COLORS[colorIndex.value];
      }
      outputSwimlanes.push({ id: parentIds[i], color });
    }

    viewModels.push({ commit, kind, inputSwimlanes, outputSwimlanes });
  }

  return viewModels;
}

export function getDisplayRefs(refs: string[]): { locals: string[]; hasRemote: boolean } {
  const locals = refs.filter(r => !r.startsWith('origin/') && !r.startsWith('tag:'));
  const hasRemote = refs.some(r => r.startsWith('origin/'));
  return { locals, hasRemote };
}

export interface GraphPathSegment {
  d: string;
  color: string;
}

export interface GraphRowGraphics {
  width: number;
  height: number;
  paths: GraphPathSegment[];
  circleIndex: number;
  circleColor: string;
  kind: GitGraphViewModel['kind'];
  parentCount: number;
}

/** Port of VS Code renderSCMHistoryItemGraph path generation */
export function buildGraphRowGraphics(vm: GitGraphViewModel): GraphRowGraphics {
  const { commit, kind, inputSwimlanes, outputSwimlanes } = vm;
  const parentIds = commit.parents;
  const H = SWIMLANE_HEIGHT;
  const W = SWIMLANE_WIDTH;
  const x = laneX;

  const inputIndex = inputSwimlanes.findIndex(node => node.id === commit.hash);
  const circleIndex = inputIndex !== -1 ? inputIndex : inputSwimlanes.length;
  const circleColor = circleIndex < outputSwimlanes.length
    ? outputSwimlanes[circleIndex].color
    : circleIndex < inputSwimlanes.length
      ? inputSwimlanes[circleIndex].color
      : HEAD_COLOR;

  const paths: GraphPathSegment[] = [];
  let outputSwimlaneIndex = 0;

  for (let index = 0; index < inputSwimlanes.length; index++) {
    const color = inputSwimlanes[index].color;

    if (inputSwimlanes[index].id === commit.hash) {
      if (index !== circleIndex) {
        paths.push({
          color,
          d: [
            `M ${x(index)} 0`,
            `A ${W} ${W} 0 0 1 ${W * index} ${W}`,
            `H ${x(circleIndex)}`,
          ].join(' '),
        });
      } else {
        outputSwimlaneIndex++;
      }
    } else if (
      outputSwimlaneIndex < outputSwimlanes.length
      && inputSwimlanes[index].id === outputSwimlanes[outputSwimlaneIndex].id
    ) {
      if (index === outputSwimlaneIndex) {
        paths.push({ color, d: `M ${x(index)} 0 V ${H}` });
      } else {
        paths.push({
          color,
          d: [
            `M ${x(index)} 0`,
            `V 6`,
            `A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 1 ${x(index) - SWIMLANE_CURVE_RADIUS} ${H / 2}`,
            `H ${x(outputSwimlaneIndex) + SWIMLANE_CURVE_RADIUS}`,
            `A ${SWIMLANE_CURVE_RADIUS} ${SWIMLANE_CURVE_RADIUS} 0 0 0 ${x(outputSwimlaneIndex)} ${H / 2 + SWIMLANE_CURVE_RADIUS}`,
            `V ${H}`,
          ].join(' '),
        });
      }
      outputSwimlaneIndex++;
    }
  }

  for (let i = 1; i < parentIds.length; i++) {
    const parentOutputIndex = findLastIndex(outputSwimlanes, parentIds[i]);
    if (parentOutputIndex === -1) continue;
    paths.push({
      color: outputSwimlanes[parentOutputIndex].color,
      d: [
        `M ${W * parentOutputIndex} ${H / 2}`,
        `A ${W} ${W} 0 0 1 ${x(parentOutputIndex)} ${H}`,
        `M ${W * parentOutputIndex} ${H / 2}`,
        `H ${x(circleIndex)}`,
      ].join(' '),
    });
  }

  if (inputIndex !== -1) {
    paths.push({
      color: inputSwimlanes[inputIndex].color,
      d: `M ${x(circleIndex)} 0 V ${H / 2}`,
    });
  }

  if (parentIds.length > 0) {
    paths.push({
      color: circleColor,
      d: `M ${x(circleIndex)} ${H / 2} V ${H}`,
    });
  }

  return {
    width: graphWidth(inputSwimlanes.length, outputSwimlanes.length),
    height: H,
    paths,
    circleIndex,
    circleColor,
    kind,
    parentCount: parentIds.length,
  };
}
