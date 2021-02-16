// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
const __extends = this.__extends || ((d, b) => {
    for (const p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
});
let MutationObserverCtor;
if (typeof WebKitMutationObserver !== 'undefined')
    MutationObserverCtor = WebKitMutationObserver;
else
    MutationObserverCtor = MutationObserver;
if (MutationObserverCtor === undefined) {
    console.error('DOM Mutation Observers are required.');
    console.error('https://developer.mozilla.org/en-US/docs/DOM/MutationObserver');
    throw Error('DOM Mutation Observers are required');
}
const NodeMap = (() => {
    class NodeMap {
        constructor() {
            this.nodes = [];
            this.values = [];
        }

        isIndex(s) {
            return +s === s >>> 0;
        }

        nodeId(node) {
            let id = node[NodeMap.ID_PROP];
            if (!id)
                id = node[NodeMap.ID_PROP] = NodeMap.nextId_++;
            return id;
        }

        set(node, value) {
            const id = this.nodeId(node);
            this.nodes[id] = node;
            this.values[id] = value;
        }

        get(node) {
            const id = this.nodeId(node);
            return this.values[id];
        }

        has(node) {
            return this.nodeId(node) in this.nodes;
        }

        delete(node) {
            const id = this.nodeId(node);
            delete this.nodes[id];
            this.values[id] = undefined;
        }

        keys() {
            const nodes = [];
            for (const id in this.nodes) {
                if (!this.isIndex(id))
                    continue;
                nodes.push(this.nodes[id]);
            }
            return nodes;
        }
    }

    NodeMap.ID_PROP = '__mutation_summary_node_map_id__';
    NodeMap.nextId_ = 1;
    return NodeMap;
})();
/**
 *  var reachableMatchableProduct = [
 *  //  STAYED_OUT,  ENTERED,     STAYED_IN,   EXITED
 *    [ STAYED_OUT,  STAYED_OUT,  STAYED_OUT,  STAYED_OUT ], // STAYED_OUT
 *    [ STAYED_OUT,  ENTERED,     ENTERED,     STAYED_OUT ], // ENTERED
 *    [ STAYED_OUT,  ENTERED,     STAYED_IN,   EXITED     ], // STAYED_IN
 *    [ STAYED_OUT,  STAYED_OUT,  EXITED,      EXITED     ]  // EXITED
 *  ];
 */
let Movement;
(Movement => {
    Movement[Movement["STAYED_OUT"] = 0] = "STAYED_OUT";
    Movement[Movement["ENTERED"] = 1] = "ENTERED";
    Movement[Movement["STAYED_IN"] = 2] = "STAYED_IN";
    Movement[Movement["REPARENTED"] = 3] = "REPARENTED";
    Movement[Movement["REORDERED"] = 4] = "REORDERED";
    Movement[Movement["EXITED"] = 5] = "EXITED";
})(Movement || (Movement = {}));
function enteredOrExited(changeType) {
    return changeType === Movement.ENTERED || changeType === Movement.EXITED;
}
const NodeChange = (() => {
    class NodeChange {
        constructor(
            node,
            childList,
            attributes,
            characterData,
            oldParentNode,
            added,
            attributeOldValues,
            characterDataOldValue
        ) {
            if (childList === void 0) { childList = false; }
            if (attributes === void 0) { attributes = false; }
            if (characterData === void 0) { characterData = false; }
            if (oldParentNode === void 0) { oldParentNode = null; }
            if (added === void 0) { added = false; }
            if (attributeOldValues === void 0) { attributeOldValues = null; }
            if (characterDataOldValue === void 0) { characterDataOldValue = null; }
            this.node = node;
            this.childList = childList;
            this.attributes = attributes;
            this.characterData = characterData;
            this.oldParentNode = oldParentNode;
            this.added = added;
            this.attributeOldValues = attributeOldValues;
            this.characterDataOldValue = characterDataOldValue;
            this.isCaseInsensitive =
                this.node.nodeType === Node.ELEMENT_NODE &&
                    this.node instanceof HTMLElement &&
                    this.node.ownerDocument instanceof HTMLDocument;
        }

        getAttributeOldValue(name) {
            if (!this.attributeOldValues)
                return undefined;
            if (this.isCaseInsensitive)
                name = name.toLowerCase();
            return this.attributeOldValues[name];
        }

        getAttributeNamesMutated() {
            const names = [];
            if (!this.attributeOldValues)
                return names;
            for (const name in this.attributeOldValues) {
                names.push(name);
            }
            return names;
        }

        attributeMutated(name, oldValue) {
            this.attributes = true;
            this.attributeOldValues = this.attributeOldValues || {};
            if (name in this.attributeOldValues)
                return;
            this.attributeOldValues[name] = oldValue;
        }

        characterDataMutated(oldValue) {
            if (this.characterData)
                return;
            this.characterData = true;
            this.characterDataOldValue = oldValue;
        }

        // Note: is it possible to receive a removal followed by a removal. This
        // can occur if the removed node is added to an non-observed node, that
        // node is added to the observed area, and then the node removed from
        // it.
        removedFromParent(parent) {
            this.childList = true;
            if (this.added || this.oldParentNode)
                this.added = false;
            else
                this.oldParentNode = parent;
        }

        insertedIntoParent() {
            this.childList = true;
            this.added = true;
        }

        // An node's oldParent is
        //   -its present parent, if its parentNode was not changed.
        //   -null if the first thing that happened to it was an add.
        //   -the node it was removed from if the first thing that happened to it
        //      was a remove.
        getOldParent() {
            if (this.childList) {
                if (this.oldParentNode)
                    return this.oldParentNode;
                if (this.added)
                    return null;
            }
            return this.node.parentNode;
        }
    }

    return NodeChange;
})();
const ChildListChange = (() => {
    function ChildListChange() {
        this.added = new NodeMap();
        this.removed = new NodeMap();
        this.maybeMoved = new NodeMap();
        this.oldPrevious = new NodeMap();
        this.moved = undefined;
    }
    return ChildListChange;
})();
const TreeChanges = (_super => {
    __extends(TreeChanges, _super);

    class TreeChanges {
        constructor(rootNode, mutations) {
            _super.call(this);
            this.rootNode = rootNode;
            this.reachableCache = undefined;
            this.wasReachableCache = undefined;
            this.anyParentsChanged = false;
            this.anyAttributesChanged = false;
            this.anyCharacterDataChanged = false;
            for (let m = 0; m < mutations.length; m++) {
                const mutation = mutations[m];
                switch (mutation.type) {
                    case 'childList':
                        this.anyParentsChanged = true;
                        for (var i = 0; i < mutation.removedNodes.length; i++) {
                            var node = mutation.removedNodes[i];
                            this.getChange(node).removedFromParent(mutation.target);
                        }
                        for (var i = 0; i < mutation.addedNodes.length; i++) {
                            var node = mutation.addedNodes[i];
                            this.getChange(node).insertedIntoParent();
                        }
                        break;
                    case 'attributes':
                        this.anyAttributesChanged = true;
                        var change = this.getChange(mutation.target);
                        change.attributeMutated(mutation.attributeName, mutation.oldValue);
                        break;
                    case 'characterData':
                        this.anyCharacterDataChanged = true;
                        var change = this.getChange(mutation.target);
                        change.characterDataMutated(mutation.oldValue);
                        break;
                }
            }
        }

        getChange(node) {
            let change = this.get(node);
            if (!change) {
                change = new NodeChange(node);
                this.set(node, change);
            }
            return change;
        }

        getOldParent(node) {
            const change = this.get(node);
            return change ? change.getOldParent() : node.parentNode;
        }

        getIsReachable(node) {
            if (node === this.rootNode)
                return true;
            if (!node)
                return false;
            this.reachableCache = this.reachableCache || new NodeMap();
            let isReachable = this.reachableCache.get(node);
            if (isReachable === undefined) {
                isReachable = this.getIsReachable(node.parentNode);
                this.reachableCache.set(node, isReachable);
            }
            return isReachable;
        }

        // A node wasReachable if its oldParent wasReachable.
        getWasReachable(node) {
            if (node === this.rootNode)
                return true;
            if (!node)
                return false;
            this.wasReachableCache = this.wasReachableCache || new NodeMap();
            let wasReachable = this.wasReachableCache.get(node);
            if (wasReachable === undefined) {
                wasReachable = this.getWasReachable(this.getOldParent(node));
                this.wasReachableCache.set(node, wasReachable);
            }
            return wasReachable;
        }

        reachabilityChange(node) {
            if (this.getIsReachable(node)) {
                return this.getWasReachable(node) ?
                    Movement.STAYED_IN : Movement.ENTERED;
            }
            return this.getWasReachable(node) ?
                Movement.EXITED : Movement.STAYED_OUT;
        }
    }

    return TreeChanges;
})(NodeMap);
const MutationProjection = (() => {
    // TOOD(any)
    class MutationProjection {
        constructor(rootNode, mutations, selectors, calcReordered, calcOldPreviousSibling) {
            this.rootNode = rootNode;
            this.mutations = mutations;
            this.selectors = selectors;
            this.calcReordered = calcReordered;
            this.calcOldPreviousSibling = calcOldPreviousSibling;
            this.treeChanges = new TreeChanges(rootNode, mutations);
            this.entered = [];
            this.exited = [];
            this.stayedIn = new NodeMap();
            this.visited = new NodeMap();
            this.childListChangeMap = undefined;
            this.characterDataOnly = undefined;
            this.matchCache = undefined;
            this.processMutations();
        }

        processMutations() {
            if (!this.treeChanges.anyParentsChanged &&
                !this.treeChanges.anyAttributesChanged)
                return;
            const changedNodes = this.treeChanges.keys();
            for (let i = 0; i < changedNodes.length; i++) {
                this.visitNode(changedNodes[i], undefined);
            }
        }

        visitNode(node, parentReachable) {
            if (this.visited.has(node))
                return;
            this.visited.set(node, true);
            const change = this.treeChanges.get(node);
            let reachable = parentReachable;
            // node inherits its parent's reachability change unless
            // its parentNode was mutated.
            if ((change && change.childList) || reachable == undefined)
                reachable = this.treeChanges.reachabilityChange(node);
            if (reachable === Movement.STAYED_OUT)
                return;
            // Cache match results for sub-patterns.
            this.matchabilityChange(node);
            if (reachable === Movement.ENTERED) {
                this.entered.push(node);
            }
            else if (reachable === Movement.EXITED) {
                this.exited.push(node);
                this.ensureHasOldPreviousSiblingIfNeeded(node);
            }
            else if (reachable === Movement.STAYED_IN) {
                let movement = Movement.STAYED_IN;
                if (change && change.childList) {
                    if (change.oldParentNode !== node.parentNode) {
                        movement = Movement.REPARENTED;
                        this.ensureHasOldPreviousSiblingIfNeeded(node);
                    }
                    else if (this.calcReordered && this.wasReordered(node)) {
                        movement = Movement.REORDERED;
                    }
                }
                this.stayedIn.set(node, movement);
            }
            if (reachable === Movement.STAYED_IN)
                return;
            // reachable === ENTERED || reachable === EXITED.
            for (let child = node.firstChild; child; child = child.nextSibling) {
                this.visitNode(child, reachable);
            }
        }

        ensureHasOldPreviousSiblingIfNeeded(node) {
            if (!this.calcOldPreviousSibling)
                return;
            this.processChildlistChanges();
            let parentNode = node.parentNode;
            const nodeChange = this.treeChanges.get(node);
            if (nodeChange && nodeChange.oldParentNode)
                parentNode = nodeChange.oldParentNode;
            let change = this.childListChangeMap.get(parentNode);
            if (!change) {
                change = new ChildListChange();
                this.childListChangeMap.set(parentNode, change);
            }
            if (!change.oldPrevious.has(node)) {
                change.oldPrevious.set(node, node.previousSibling);
            }
        }

        getChanged({added, removed, reparented, reordered}, selectors, characterDataOnly) {
            this.selectors = selectors;
            this.characterDataOnly = characterDataOnly;
            for (var i = 0; i < this.entered.length; i++) {
                var node = this.entered[i];
                var matchable = this.matchabilityChange(node);
                if (matchable === Movement.ENTERED || matchable === Movement.STAYED_IN)
                    added.push(node);
            }
            const stayedInNodes = this.stayedIn.keys();
            for (var i = 0; i < stayedInNodes.length; i++) {
                var node = stayedInNodes[i];
                var matchable = this.matchabilityChange(node);
                if (matchable === Movement.ENTERED) {
                    added.push(node);
                }
                else if (matchable === Movement.EXITED) {
                    removed.push(node);
                }
                else if (matchable === Movement.STAYED_IN && (reparented || reordered)) {
                    const movement = this.stayedIn.get(node);
                    if (reparented && movement === Movement.REPARENTED)
                        reparented.push(node);
                    else if (reordered && movement === Movement.REORDERED)
                        reordered.push(node);
                }
            }
            for (var i = 0; i < this.exited.length; i++) {
                var node = this.exited[i];
                var matchable = this.matchabilityChange(node);
                if (matchable === Movement.EXITED || matchable === Movement.STAYED_IN)
                    removed.push(node);
            }
        }

        getOldParentNode(node) {
            const change = this.treeChanges.get(node);
            if (change && change.childList)
                return change.oldParentNode ? change.oldParentNode : null;
            const reachabilityChange = this.treeChanges.reachabilityChange(node);
            if (reachabilityChange === Movement.STAYED_OUT || reachabilityChange === Movement.ENTERED)
                throw Error('getOldParentNode requested on invalid node.');
            return node.parentNode;
        }

        getOldPreviousSibling(node) {
            let parentNode = node.parentNode;
            const nodeChange = this.treeChanges.get(node);
            if (nodeChange && nodeChange.oldParentNode)
                parentNode = nodeChange.oldParentNode;
            const change = this.childListChangeMap.get(parentNode);
            if (!change)
                throw Error('getOldPreviousSibling requested on invalid node.');
            return change.oldPrevious.get(node);
        }

        getOldAttribute(element, attrName) {
            const change = this.treeChanges.get(element);
            if (!change || !change.attributes)
                throw Error('getOldAttribute requested on invalid node.');
            const value = change.getAttributeOldValue(attrName);
            if (value === undefined)
                throw Error('getOldAttribute requested for unchanged attribute name.');
            return value;
        }

        attributeChangedNodes(includeAttributes) {
            if (!this.treeChanges.anyAttributesChanged)
                return {}; // No attributes mutations occurred.
            let attributeFilter;
            let caseInsensitiveFilter;
            if (includeAttributes) {
                attributeFilter = {};
                caseInsensitiveFilter = {};
                for (var i = 0; i < includeAttributes.length; i++) {
                    var attrName = includeAttributes[i];
                    attributeFilter[attrName] = true;
                    caseInsensitiveFilter[attrName.toLowerCase()] = attrName;
                }
            }
            const result = {};
            const nodes = this.treeChanges.keys();
            for (var i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const change = this.treeChanges.get(node);
                if (!change.attributes)
                    continue;
                if (Movement.STAYED_IN !== this.treeChanges.reachabilityChange(node) ||
                    Movement.STAYED_IN !== this.matchabilityChange(node)) {
                    continue;
                }
                const element = node;
                const changedAttrNames = change.getAttributeNamesMutated();
                for (let j = 0; j < changedAttrNames.length; j++) {
                    var attrName = changedAttrNames[j];
                    if (attributeFilter &&
                        !attributeFilter[attrName] &&
                        !(change.isCaseInsensitive && caseInsensitiveFilter[attrName])) {
                        continue;
                    }
                    const oldValue = change.getAttributeOldValue(attrName);
                    if (oldValue === element.getAttribute(attrName))
                        continue;
                    if (caseInsensitiveFilter && change.isCaseInsensitive)
                        attrName = caseInsensitiveFilter[attrName];
                    result[attrName] = result[attrName] || [];
                    result[attrName].push(element);
                }
            }
            return result;
        }

        getOldCharacterData(node) {
            const change = this.treeChanges.get(node);
            if (!change || !change.characterData)
                throw Error('getOldCharacterData requested on invalid node.');
            return change.characterDataOldValue;
        }

        getCharacterDataChanged() {
            if (!this.treeChanges.anyCharacterDataChanged)
                return []; // No characterData mutations occurred.
            const nodes = this.treeChanges.keys();
            const result = [];
            for (let i = 0; i < nodes.length; i++) {
                const target = nodes[i];
                if (Movement.STAYED_IN !== this.treeChanges.reachabilityChange(target))
                    continue;
                const change = this.treeChanges.get(target);
                if (!change.characterData ||
                    target.textContent == change.characterDataOldValue)
                    continue;
                result.push(target);
            }
            return result;
        }

        computeMatchabilityChange(selector, el) {
            if (!this.matchCache)
                this.matchCache = [];
            if (!this.matchCache[selector.uid])
                this.matchCache[selector.uid] = new NodeMap();
            const cache = this.matchCache[selector.uid];
            let result = cache.get(el);
            if (result === undefined) {
                result = selector.matchabilityChange(el, this.treeChanges.get(el));
                cache.set(el, result);
            }
            return result;
        }

        matchabilityChange(node) {
            const _this = this;
            // TODO(rafaelw): Include PI, CDATA?
            // Only include text nodes.
            if (this.characterDataOnly) {
                switch (node.nodeType) {
                    case Node.COMMENT_NODE:
                    case Node.TEXT_NODE:
                        return Movement.STAYED_IN;
                    default:
                        return Movement.STAYED_OUT;
                }
            }
            // No element filter. Include all nodes.
            if (!this.selectors)
                return Movement.STAYED_IN;
            // Element filter. Exclude non-elements.
            if (node.nodeType !== Node.ELEMENT_NODE)
                return Movement.STAYED_OUT;
            const el = node;
            const matchChanges = this.selectors.map(selector => _this.computeMatchabilityChange(selector, el));
            let accum = Movement.STAYED_OUT;
            let i = 0;
            while (accum !== Movement.STAYED_IN && i < matchChanges.length) {
                switch (matchChanges[i]) {
                    case Movement.STAYED_IN:
                        accum = Movement.STAYED_IN;
                        break;
                    case Movement.ENTERED:
                        if (accum === Movement.EXITED)
                            accum = Movement.STAYED_IN;
                        else
                            accum = Movement.ENTERED;
                        break;
                    case Movement.EXITED:
                        if (accum === Movement.ENTERED)
                            accum = Movement.STAYED_IN;
                        else
                            accum = Movement.EXITED;
                        break;
                }
                i++;
            }
            return accum;
        }

        getChildlistChange(el) {
            let change = this.childListChangeMap.get(el);
            if (!change) {
                change = new ChildListChange();
                this.childListChangeMap.set(el, change);
            }
            return change;
        }

        processChildlistChanges() {
            if (this.childListChangeMap)
                return;
            this.childListChangeMap = new NodeMap();
            for (let i = 0; i < this.mutations.length; i++) {
                const mutation = this.mutations[i];
                if (mutation.type != 'childList')
                    continue;
                if (this.treeChanges.reachabilityChange(mutation.target) !== Movement.STAYED_IN &&
                    !this.calcOldPreviousSibling)
                    continue;
                const change = this.getChildlistChange(mutation.target);
                let oldPrevious = mutation.previousSibling;
                function recordOldPrevious(node, previous) {
                    if (!node ||
                        change.oldPrevious.has(node) ||
                        change.added.has(node) ||
                        change.maybeMoved.has(node))
                        return;
                    if (previous &&
                        (change.added.has(previous) ||
                            change.maybeMoved.has(previous)))
                        return;
                    change.oldPrevious.set(node, previous);
                }
                for (var j = 0; j < mutation.removedNodes.length; j++) {
                    var node = mutation.removedNodes[j];
                    recordOldPrevious(node, oldPrevious);
                    if (change.added.has(node)) {
                        change.added.delete(node);
                    }
                    else {
                        change.removed.set(node, true);
                        change.maybeMoved.delete(node);
                    }
                    oldPrevious = node;
                }
                recordOldPrevious(mutation.nextSibling, oldPrevious);
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    if (change.removed.has(node)) {
                        change.removed.delete(node);
                        change.maybeMoved.set(node, true);
                    }
                    else {
                        change.added.set(node, true);
                    }
                }
            }
        }

        wasReordered(node) {
            if (!this.treeChanges.anyParentsChanged)
                return false;
            this.processChildlistChanges();
            let parentNode = node.parentNode;
            const nodeChange = this.treeChanges.get(node);
            if (nodeChange && nodeChange.oldParentNode)
                parentNode = nodeChange.oldParentNode;
            const change = this.childListChangeMap.get(parentNode);
            if (!change)
                return false;
            if (change.moved)
                return change.moved.get(node);
            change.moved = new NodeMap();
            const pendingMoveDecision = new NodeMap();
            function isMoved(node) {
                if (!node)
                    return false;
                if (!change.maybeMoved.has(node))
                    return false;
                let didMove = change.moved.get(node);
                if (didMove !== undefined)
                    return didMove;
                if (pendingMoveDecision.has(node)) {
                    didMove = true;
                }
                else {
                    pendingMoveDecision.set(node, true);
                    didMove = getPrevious(node) !== getOldPrevious(node);
                }
                if (pendingMoveDecision.has(node)) {
                    pendingMoveDecision.delete(node);
                    change.moved.set(node, didMove);
                }
                else {
                    didMove = change.moved.get(node);
                }
                return didMove;
            }
            const oldPreviousCache = new NodeMap();
            function getOldPrevious(node) {
                let oldPrevious = oldPreviousCache.get(node);
                if (oldPrevious !== undefined)
                    return oldPrevious;
                oldPrevious = change.oldPrevious.get(node);
                while (oldPrevious &&
                    (change.removed.has(oldPrevious) || isMoved(oldPrevious))) {
                    oldPrevious = getOldPrevious(oldPrevious);
                }
                if (oldPrevious === undefined)
                    oldPrevious = node.previousSibling;
                oldPreviousCache.set(node, oldPrevious);
                return oldPrevious;
            }
            const previousCache = new NodeMap();
            function getPrevious(node) {
                if (previousCache.has(node))
                    return previousCache.get(node);
                let previous = node.previousSibling;
                while (previous && (change.added.has(previous) || isMoved(previous)))
                    previous = previous.previousSibling;
                previousCache.set(node, previous);
                return previous;
            }
            change.maybeMoved.keys().forEach(isMoved);
            return change.moved.get(node);
        }
    }

    return MutationProjection;
})();
const Summary = (() => {
    class Summary {
        constructor(projection, query) {
            const _this = this;
            this.projection = projection;
            this.added = [];
            this.removed = [];
            this.reparented = query.all || query.element || query.characterData ? [] : undefined;
            this.reordered = query.all ? [] : undefined;
            projection.getChanged(this, query.elementFilter, query.characterData);
            if (query.all || query.attribute || query.attributeList) {
                const filter = query.attribute ? [query.attribute] : query.attributeList;
                const attributeChanged = projection.attributeChangedNodes(filter);
                if (query.attribute) {
                    this.valueChanged = attributeChanged[query.attribute] || [];
                }
                else {
                    this.attributeChanged = attributeChanged;
                    if (query.attributeList) {
                        query.attributeList.forEach(attrName => {
                            if (!_this.attributeChanged.hasOwnProperty(attrName))
                                _this.attributeChanged[attrName] = [];
                        });
                    }
                }
            }
            if (query.all || query.characterData) {
                const characterDataChanged = projection.getCharacterDataChanged();
                if (query.characterData)
                    this.valueChanged = characterDataChanged;
                else
                    this.characterDataChanged = characterDataChanged;
            }
            if (this.reordered)
                this.getOldPreviousSibling = projection.getOldPreviousSibling.bind(projection);
        }

        getOldParentNode(node) {
            return this.projection.getOldParentNode(node);
        }

        getOldAttribute(node, name) {
            return this.projection.getOldAttribute(node, name);
        }

        getOldCharacterData(node) {
            return this.projection.getOldCharacterData(node);
        }

        getOldPreviousSibling(node) {
            return this.projection.getOldPreviousSibling(node);
        }
    }

    return Summary;
})();
// TODO(rafaelw): Allow ':' and '.' as valid name characters.
const validNameInitialChar = /[a-zA-Z_]+/;
const validNameNonInitialChar = /[a-zA-Z0-9_\-]+/;
// TODO(rafaelw): Consider allowing backslash in the attrValue.
// TODO(rafaelw): There's got a to be way to represent this state machine
// more compactly???
function escapeQuotes(value) {
    return `"${value.replace(/"/, '\\\"')}"`;
}
const Qualifier = (() => {
    class Qualifier {
        matches(oldValue) {
            if (oldValue === null)
                return false;
            if (this.attrValue === undefined)
                return true;
            if (!this.contains)
                return this.attrValue == oldValue;
            const tokens = oldValue.split(' ');
            for (let i = 0; i < tokens.length; i++) {
                if (this.attrValue === tokens[i])
                    return true;
            }
            return false;
        }

        toString() {
            if (this.attrName === 'class' && this.contains)
                return `.${this.attrValue}`;
            if (this.attrName === 'id' && !this.contains)
                return `#${this.attrValue}`;
            if (this.contains)
                return `[${this.attrName}~=${escapeQuotes(this.attrValue)}]`;
            if ('attrValue' in this)
                return `[${this.attrName}=${escapeQuotes(this.attrValue)}]`;
            return `[${this.attrName}]`;
        }
    }

    return Qualifier;
})();
const Selector = (() => {
    class Selector {
        constructor() {
            this.uid = Selector.nextUid++;
            this.qualifiers = [];
        }

        get caseInsensitiveTagName() {
            return this.tagName.toUpperCase();
        }

        get selectorString() {
            return this.tagName + this.qualifiers.join('');
        }

        isMatching(el) {
            return el[Selector.matchesSelector](this.selectorString);
        }

        wasMatching(el, change, isMatching) {
            if (!change || !change.attributes)
                return isMatching;
            const tagName = change.isCaseInsensitive ? this.caseInsensitiveTagName : this.tagName;
            if (tagName !== '*' && tagName !== el.tagName)
                return false;
            const attributeOldValues = [];
            let anyChanged = false;
            for (var i = 0; i < this.qualifiers.length; i++) {
                var qualifier = this.qualifiers[i];
                var oldValue = change.getAttributeOldValue(qualifier.attrName);
                attributeOldValues.push(oldValue);
                anyChanged = anyChanged || (oldValue !== undefined);
            }
            if (!anyChanged)
                return isMatching;
            for (var i = 0; i < this.qualifiers.length; i++) {
                var qualifier = this.qualifiers[i];
                var oldValue = attributeOldValues[i];
                if (oldValue === undefined)
                    oldValue = el.getAttribute(qualifier.attrName);
                if (!qualifier.matches(oldValue))
                    return false;
            }
            return true;
        }

        matchabilityChange(el, change) {
            const isMatching = this.isMatching(el);
            if (isMatching)
                return this.wasMatching(el, change, isMatching) ? Movement.STAYED_IN : Movement.ENTERED;
            else
                return this.wasMatching(el, change, isMatching) ? Movement.EXITED : Movement.STAYED_OUT;
        }
    }

    Selector.parseSelectors = input => {
        const selectors = [];
        let currentSelector;
        let currentQualifier;
        function newSelector() {
            if (currentSelector) {
                if (currentQualifier) {
                    currentSelector.qualifiers.push(currentQualifier);
                    currentQualifier = undefined;
                }
                selectors.push(currentSelector);
            }
            currentSelector = new Selector();
        }
        function newQualifier() {
            if (currentQualifier)
                currentSelector.qualifiers.push(currentQualifier);
            currentQualifier = new Qualifier();
        }
        const WHITESPACE = /\s/;
        let valueQuoteChar;
        const SYNTAX_ERROR = 'Invalid or unsupported selector syntax.';
        const SELECTOR = 1;
        const TAG_NAME = 2;
        const QUALIFIER = 3;
        const QUALIFIER_NAME_FIRST_CHAR = 4;
        const QUALIFIER_NAME = 5;
        const ATTR_NAME_FIRST_CHAR = 6;
        const ATTR_NAME = 7;
        const EQUIV_OR_ATTR_QUAL_END = 8;
        const EQUAL = 9;
        const ATTR_QUAL_END = 10;
        const VALUE_FIRST_CHAR = 11;
        const VALUE = 12;
        const QUOTED_VALUE = 13;
        const SELECTOR_SEPARATOR = 14;
        let state = SELECTOR;
        let i = 0;
        while (i < input.length) {
            const c = input[i++];
            switch (state) {
                case SELECTOR:
                    if (c.match(validNameInitialChar)) {
                        newSelector();
                        currentSelector.tagName = c;
                        state = TAG_NAME;
                        break;
                    }
                    if (c == '*') {
                        newSelector();
                        currentSelector.tagName = '*';
                        state = QUALIFIER;
                        break;
                    }
                    if (c == '.') {
                        newSelector();
                        newQualifier();
                        currentSelector.tagName = '*';
                        currentQualifier.attrName = 'class';
                        currentQualifier.contains = true;
                        state = QUALIFIER_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c == '#') {
                        newSelector();
                        newQualifier();
                        currentSelector.tagName = '*';
                        currentQualifier.attrName = 'id';
                        state = QUALIFIER_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c == '[') {
                        newSelector();
                        newQualifier();
                        currentSelector.tagName = '*';
                        currentQualifier.attrName = '';
                        state = ATTR_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c.match(WHITESPACE))
                        break;
                    throw Error(SYNTAX_ERROR);
                case TAG_NAME:
                    if (c.match(validNameNonInitialChar)) {
                        currentSelector.tagName += c;
                        break;
                    }
                    if (c == '.') {
                        newQualifier();
                        currentQualifier.attrName = 'class';
                        currentQualifier.contains = true;
                        state = QUALIFIER_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c == '#') {
                        newQualifier();
                        currentQualifier.attrName = 'id';
                        state = QUALIFIER_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c == '[') {
                        newQualifier();
                        currentQualifier.attrName = '';
                        state = ATTR_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c.match(WHITESPACE)) {
                        state = SELECTOR_SEPARATOR;
                        break;
                    }
                    if (c == ',') {
                        state = SELECTOR;
                        break;
                    }
                    throw Error(SYNTAX_ERROR);
                case QUALIFIER:
                    if (c == '.') {
                        newQualifier();
                        currentQualifier.attrName = 'class';
                        currentQualifier.contains = true;
                        state = QUALIFIER_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c == '#') {
                        newQualifier();
                        currentQualifier.attrName = 'id';
                        state = QUALIFIER_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c == '[') {
                        newQualifier();
                        currentQualifier.attrName = '';
                        state = ATTR_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c.match(WHITESPACE)) {
                        state = SELECTOR_SEPARATOR;
                        break;
                    }
                    if (c == ',') {
                        state = SELECTOR;
                        break;
                    }
                    throw Error(SYNTAX_ERROR);
                case QUALIFIER_NAME_FIRST_CHAR:
                    if (c.match(validNameInitialChar)) {
                        currentQualifier.attrValue = c;
                        state = QUALIFIER_NAME;
                        break;
                    }
                    throw Error(SYNTAX_ERROR);
                case QUALIFIER_NAME:
                    if (c.match(validNameNonInitialChar)) {
                        currentQualifier.attrValue += c;
                        break;
                    }
                    if (c == '.') {
                        newQualifier();
                        currentQualifier.attrName = 'class';
                        currentQualifier.contains = true;
                        state = QUALIFIER_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c == '#') {
                        newQualifier();
                        currentQualifier.attrName = 'id';
                        state = QUALIFIER_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c == '[') {
                        newQualifier();
                        state = ATTR_NAME_FIRST_CHAR;
                        break;
                    }
                    if (c.match(WHITESPACE)) {
                        state = SELECTOR_SEPARATOR;
                        break;
                    }
                    if (c == ',') {
                        state = SELECTOR;
                        break;
                    }
                    throw Error(SYNTAX_ERROR);
                case ATTR_NAME_FIRST_CHAR:
                    if (c.match(validNameInitialChar)) {
                        currentQualifier.attrName = c;
                        state = ATTR_NAME;
                        break;
                    }
                    if (c.match(WHITESPACE))
                        break;
                    throw Error(SYNTAX_ERROR);
                case ATTR_NAME:
                    if (c.match(validNameNonInitialChar)) {
                        currentQualifier.attrName += c;
                        break;
                    }
                    if (c.match(WHITESPACE)) {
                        state = EQUIV_OR_ATTR_QUAL_END;
                        break;
                    }
                    if (c == '~') {
                        currentQualifier.contains = true;
                        state = EQUAL;
                        break;
                    }
                    if (c == '=') {
                        currentQualifier.attrValue = '';
                        state = VALUE_FIRST_CHAR;
                        break;
                    }
                    if (c == ']') {
                        state = QUALIFIER;
                        break;
                    }
                    throw Error(SYNTAX_ERROR);
                case EQUIV_OR_ATTR_QUAL_END:
                    if (c == '~') {
                        currentQualifier.contains = true;
                        state = EQUAL;
                        break;
                    }
                    if (c == '=') {
                        currentQualifier.attrValue = '';
                        state = VALUE_FIRST_CHAR;
                        break;
                    }
                    if (c == ']') {
                        state = QUALIFIER;
                        break;
                    }
                    if (c.match(WHITESPACE))
                        break;
                    throw Error(SYNTAX_ERROR);
                case EQUAL:
                    if (c == '=') {
                        currentQualifier.attrValue = '';
                        state = VALUE_FIRST_CHAR;
                        break;
                    }
                    throw Error(SYNTAX_ERROR);
                case ATTR_QUAL_END:
                    if (c == ']') {
                        state = QUALIFIER;
                        break;
                    }
                    if (c.match(WHITESPACE))
                        break;
                    throw Error(SYNTAX_ERROR);
                case VALUE_FIRST_CHAR:
                    if (c.match(WHITESPACE))
                        break;
                    if (c == '"' || c == "'") {
                        valueQuoteChar = c;
                        state = QUOTED_VALUE;
                        break;
                    }
                    currentQualifier.attrValue += c;
                    state = VALUE;
                    break;
                case VALUE:
                    if (c.match(WHITESPACE)) {
                        state = ATTR_QUAL_END;
                        break;
                    }
                    if (c == ']') {
                        state = QUALIFIER;
                        break;
                    }
                    if (c == "'" || c == '"')
                        throw Error(SYNTAX_ERROR);
                    currentQualifier.attrValue += c;
                    break;
                case QUOTED_VALUE:
                    if (c == valueQuoteChar) {
                        state = ATTR_QUAL_END;
                        break;
                    }
                    currentQualifier.attrValue += c;
                    break;
                case SELECTOR_SEPARATOR:
                    if (c.match(WHITESPACE))
                        break;
                    if (c == ',') {
                        state = SELECTOR;
                        break;
                    }
                    throw Error(SYNTAX_ERROR);
            }
        }
        switch (state) {
            case SELECTOR:
            case TAG_NAME:
            case QUALIFIER:
            case QUALIFIER_NAME:
            case SELECTOR_SEPARATOR:
                // Valid end states.
                newSelector();
                break;
            default:
                throw Error(SYNTAX_ERROR);
        }
        if (!selectors.length)
            throw Error(SYNTAX_ERROR);
        return selectors;
    };
    Selector.nextUid = 1;
    Selector.matchesSelector = (() => {
        const element = document.createElement('div');
        if (typeof element['webkitMatchesSelector'] === 'function')
            return 'webkitMatchesSelector';
        if (typeof element['mozMatchesSelector'] === 'function')
            return 'mozMatchesSelector';
        if (typeof element['msMatchesSelector'] === 'function')
            return 'msMatchesSelector';
        return 'matchesSelector';
    })();
    return Selector;
})();
const attributeFilterPattern = /^([a-zA-Z:_]+[a-zA-Z0-9_\-:\.]*)$/;
function validateAttribute(attribute) {
    if (typeof attribute != 'string')
        throw Error('Invalid request opion. attribute must be a non-zero length string.');
    attribute = attribute.trim();
    if (!attribute)
        throw Error('Invalid request opion. attribute must be a non-zero length string.');
    if (!attribute.match(attributeFilterPattern))
        throw Error(`Invalid request option. invalid attribute name: ${attribute}`);
    return attribute;
}
function validateElementAttributes(attribs) {
    if (!attribs.trim().length)
        throw Error('Invalid request option: elementAttributes must contain at least one attribute.');
    const lowerAttributes = {};
    const attributes = {};
    const tokens = attribs.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
        var name = tokens[i];
        if (!name)
            continue;
        var name = validateAttribute(name);
        const nameLower = name.toLowerCase();
        if (lowerAttributes[nameLower])
            throw Error('Invalid request option: observing multiple case variations of the same attribute is not supported.');
        attributes[name] = true;
        lowerAttributes[nameLower] = true;
    }
    return Object.keys(attributes);
}
function elementFilterAttributes(selectors) {
    const attributes = {};
    selectors.forEach(({qualifiers}) => {
        qualifiers.forEach(({attrName}) => {
            attributes[attrName] = true;
        });
    });
    return Object.keys(attributes);
}
const MutationSummary = (() => {
    class MutationSummary {
        constructor(opts) {
            const _this = this;
            this.connected = false;
            this.options = MutationSummary.validateOptions(opts);
            this.observerOptions = MutationSummary.createObserverOptions(this.options.queries);
            this.root = this.options.rootNode;
            this.callback = this.options.callback;
            this.elementFilter = Array.prototype.concat.apply([], this.options.queries.map(({elementFilter}) => elementFilter ? elementFilter : []));
            if (!this.elementFilter.length)
                this.elementFilter = undefined;
            this.calcReordered = this.options.queries.some(({all}) => all);
            this.queryValidators = []; // TODO(rafaelw): Shouldn't always define this.
            if (MutationSummary.createQueryValidator) {
                this.queryValidators = this.options.queries.map(query => MutationSummary.createQueryValidator(_this.root, query));
            }
            this.observer = new MutationObserverCtor(mutations => {
                _this.observerCallback(mutations);
            });
            this.reconnect();
        }

        createSummaries(mutations) {
            if (!mutations || !mutations.length)
                return [];
            const projection = new MutationProjection(this.root, mutations, this.elementFilter, this.calcReordered, this.options.oldPreviousSibling);
            const summaries = [];
            for (let i = 0; i < this.options.queries.length; i++) {
                summaries.push(new Summary(projection, this.options.queries[i]));
            }
            return summaries;
        }

        checkpointQueryValidators() {
            this.queryValidators.forEach(validator => {
                if (validator)
                    validator.recordPreviousState();
            });
        }

        runQueryValidators(summaries) {
            this.queryValidators.forEach((validator, index) => {
                if (validator)
                    validator.validate(summaries[index]);
            });
        }

        changesToReport(summaries) {
            return summaries.some(summary => {
                const summaryProps = ['added', 'removed', 'reordered', 'reparented',
                    'valueChanged', 'characterDataChanged'];
                if (summaryProps.some(prop => summary[prop] && summary[prop].length))
                    return true;
                if (summary.attributeChanged) {
                    const attrNames = Object.keys(summary.attributeChanged);
                    const attrsChanged = attrNames.some(attrName => !!summary.attributeChanged[attrName].length);
                    if (attrsChanged)
                        return true;
                }
                return false;
            });
        }

        observerCallback(mutations) {
            if (!this.options.observeOwnChanges)
                this.observer.disconnect();
            const summaries = this.createSummaries(mutations);
            this.runQueryValidators(summaries);
            if (this.options.observeOwnChanges)
                this.checkpointQueryValidators();
            if (this.changesToReport(summaries))
                this.callback(summaries);
            // disconnect() may have been called during the callback.
            if (!this.options.observeOwnChanges && this.connected) {
                this.checkpointQueryValidators();
                this.observer.observe(this.root, this.observerOptions);
            }
        }

        reconnect() {
            if (this.connected)
                throw Error('Already connected');
            this.observer.observe(this.root, this.observerOptions);
            this.connected = true;
            this.checkpointQueryValidators();
        }

        takeSummaries() {
            if (!this.connected)
                throw Error('Not connected');
            const summaries = this.createSummaries(this.observer.takeRecords());
            return this.changesToReport(summaries) ? summaries : undefined;
        }

        disconnect() {
            const summaries = this.takeSummaries();
            this.observer.disconnect();
            this.connected = false;
            return summaries;
        }
    }

    MutationSummary.createObserverOptions = queries => {
        const observerOptions = {
            childList: true,
            subtree: true
        };
        let attributeFilter;
        function observeAttributes(attributes) {
            if (observerOptions.attributes && !attributeFilter)
                return; // already observing all.
            observerOptions.attributes = true;
            observerOptions.attributeOldValue = true;
            if (!attributes) {
                // observe all.
                attributeFilter = undefined;
                return;
            }
            // add to observed.
            attributeFilter = attributeFilter || {};
            attributes.forEach(attribute => {
                attributeFilter[attribute] = true;
                attributeFilter[attribute.toLowerCase()] = true;
            });
        }
        queries.forEach(query => {
            if (query.characterData) {
                observerOptions.characterData = true;
                observerOptions.characterDataOldValue = true;
                return;
            }
            if (query.all) {
                observeAttributes();
                observerOptions.characterData = true;
                observerOptions.characterDataOldValue = true;
                return;
            }
            if (query.attribute) {
                observeAttributes([query.attribute.trim()]);
                return;
            }
            const attributes = elementFilterAttributes(query.elementFilter).concat(query.attributeList || []);
            if (attributes.length)
                observeAttributes(attributes);
        });
        if (attributeFilter)
            observerOptions.attributeFilter = Object.keys(attributeFilter);
        return observerOptions;
    };
    MutationSummary.validateOptions = options => {
        for (const prop in options) {
            if (!(prop in MutationSummary.optionKeys))
                throw Error(`Invalid option: ${prop}`);
        }
        if (typeof options.callback !== 'function')
            throw Error('Invalid options: callback is required and must be a function');
        if (!options.queries || !options.queries.length)
            throw Error('Invalid options: queries must contain at least one query request object.');
        const opts = {
            callback: options.callback,
            rootNode: options.rootNode || document,
            observeOwnChanges: !!options.observeOwnChanges,
            oldPreviousSibling: !!options.oldPreviousSibling,
            queries: []
        };
        for (let i = 0; i < options.queries.length; i++) {
            const request = options.queries[i];
            // all
            if (request.all) {
                if (Object.keys(request).length > 1)
                    throw Error('Invalid request option. all has no options.');
                opts.queries.push({ all: true });
                continue;
            }
            // attribute
            if ('attribute' in request) {
                var query = {
                    attribute: validateAttribute(request.attribute)
                };
                query.elementFilter = Selector.parseSelectors(`*[${query.attribute}]`);
                if (Object.keys(request).length > 1)
                    throw Error('Invalid request option. attribute has no options.');
                opts.queries.push(query);
                continue;
            }
            // element
            if ('element' in request) {
                let requestOptionCount = Object.keys(request).length;
                var query = {
                    element: request.element,
                    elementFilter: Selector.parseSelectors(request.element)
                };
                if (request.hasOwnProperty('elementAttributes')) {
                    query.attributeList = validateElementAttributes(request.elementAttributes);
                    requestOptionCount--;
                }
                if (requestOptionCount > 1)
                    throw Error('Invalid request option. element only allows elementAttributes option.');
                opts.queries.push(query);
                continue;
            }
            // characterData
            if (request.characterData) {
                if (Object.keys(request).length > 1)
                    throw Error('Invalid request option. characterData has no options.');
                opts.queries.push({ characterData: true });
                continue;
            }
            throw Error('Invalid request option. Unknown query request.');
        }
        return opts;
    };
    MutationSummary.NodeMap = NodeMap; // exposed for use in TreeMirror.
    MutationSummary.parseElementFilter = Selector.parseSelectors; // exposed for testing.
    MutationSummary.optionKeys = {
        'callback': true,
        'queries': true,
        'rootNode': true,
        'oldPreviousSibling': true,
        'observeOwnChanges': true
    };
    return MutationSummary;
})();

export default MutationSummary;
