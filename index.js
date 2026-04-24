const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── YOUR CREDENTIALS ──────────────────────────────────────────
const USER_ID = "03-01-2004";       // ← change this
const EMAIL_ID = "aa3299@srmist.edu.in";      // ← change this
const ROLL_NUMBER = "RA2311003020741";        // ← change this
// ─────────────────────────────────────────────────────────────

function isValidEntry(raw) {
  const s = raw.trim();
  return /^[A-Z]->[A-Z]$/.test(s) && s[0] !== s[3];
}

function buildGraph(edges) {
  // edges: array of "X->Y" strings (valid, non-duplicate)
  const children = {}; // parent -> [children]
  const parents = {};  // child -> parent (first-encountered wins)
  const allNodes = new Set();

  for (const e of edges) {
    const [p, c] = e.split("->");
    allNodes.add(p);
    allNodes.add(c);
    if (!children[p]) children[p] = [];
    if (parents[c] === undefined) {
      // first parent wins
      parents[c] = p;
      children[p].push(c);
    }
    // else: silently discard multi-parent edge
  }

  return { children, parents, allNodes };
}

function detectCycle(node, children, visited, recStack) {
  visited.add(node);
  recStack.add(node);
  for (const child of (children[node] || [])) {
    if (!visited.has(child)) {
      if (detectCycle(child, children, visited, recStack)) return true;
    } else if (recStack.has(child)) {
      return true;
    }
  }
  recStack.delete(node);
  return false;
}

function buildTree(node, children) {
  const obj = {};
  for (const child of (children[node] || [])) {
    obj[child] = buildTree(child, children);
  }
  return obj;
}

function calcDepth(node, children) {
  const kids = children[node] || [];
  if (kids.length === 0) return 1;
  return 1 + Math.max(...kids.map((c) => calcDepth(c, children)));
}

function getConnectedGroups(allNodes, children, parents) {
  // Union-Find style: group nodes that are connected
  const visited = new Set();
  const groups = [];

  function dfsGroup(node, group) {
    if (visited.has(node)) return;
    visited.add(node);
    group.add(node);
    // traverse children
    for (const c of (children[node] || [])) dfsGroup(c, group);
    // traverse parent
    if (parents[node] !== undefined) dfsGroup(parents[node], group);
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      const group = new Set();
      dfsGroup(node, group);
      groups.push(group);
    }
  }
  return groups;
}

app.post("/bfhl", (req, res) => {
  const data = req.body?.data;
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "data must be an array" });
  }

  const invalidEntries = [];
  const duplicateEdges = [];
  const seenEdges = new Set();
  const validEdges = [];

  for (const raw of data) {
    const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
    if (!isValidEntry(s)) {
      invalidEntries.push(raw.trim !== undefined ? raw.trim() : raw);
      continue;
    }
    if (seenEdges.has(s)) {
      if (!duplicateEdges.includes(s)) duplicateEdges.push(s);
    } else {
      seenEdges.add(s);
      validEdges.push(s);
    }
  }

  const { children, parents, allNodes } = buildGraph(validEdges);
  const groups = getConnectedGroups(allNodes, children, parents);

  const hierarchies = [];
  let totalTrees = 0;
  let totalCycles = 0;

  for (const group of groups) {
    // Find root: nodes in group that never appear as a child
    const roots = [...group].filter((n) => parents[n] === undefined).sort();
    const root = roots.length > 0 ? roots[0] : [...group].sort()[0];

    // Build sub-graph for this group
    const subChildren = {};
    for (const n of group) {
      if (children[n]) subChildren[n] = children[n].filter((c) => group.has(c));
    }

    // Cycle detection
    const visitedCycle = new Set();
    const recStack = new Set();
    let hasCycle = false;
    for (const n of group) {
      if (!visitedCycle.has(n)) {
        if (detectCycle(n, subChildren, visitedCycle, recStack)) {
          hasCycle = true;
          break;
        }
      }
    }

    if (hasCycle) {
      totalCycles++;
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      totalTrees++;
      const tree = {};
      tree[root] = buildTree(root, subChildren);
      const depth = calcDepth(root, subChildren);
      hierarchies.push({ root, tree, depth });
    }
  }

  // Sort hierarchies: non-cyclic first by root alpha, then cyclic
  hierarchies.sort((a, b) => {
    if (a.has_cycle && !b.has_cycle) return 1;
    if (!a.has_cycle && b.has_cycle) return -1;
    return a.root.localeCompare(b.root);
  });

  // largest_tree_root: max depth, tiebreak lex smallest
  let largestRoot = "";
  let maxDepth = -1;
  for (const h of hierarchies) {
    if (!h.has_cycle) {
      if (h.depth > maxDepth || (h.depth === maxDepth && h.root < largestRoot)) {
        maxDepth = h.depth;
        largestRoot = h.root;
      }
    }
  }

  return res.json({
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestRoot,
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
