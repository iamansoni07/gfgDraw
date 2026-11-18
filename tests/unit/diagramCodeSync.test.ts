import { describe, it, expect } from 'vitest';
import {
  parseMermaidFlowchart,
  layoutDiagramToCanvas,
  serializeCanvasToMermaid,
} from '../../frontend/src/engine/diagramCodeSync';

describe('Diagram-as-Code & Mermaid Flowchart Sync Engine', () => {
  it('parses flowchart directions, node shapes, and labeled edges', () => {
    const mermaid = `
      flowchart LR
      A[API Gateway] -->|auth| B{Auth Service}
      B --> C[(User DB)]
      B --> D((Cache))
    `;

    const parsed = parseMermaidFlowchart(mermaid);
    expect(parsed.direction).toBe('LR');
    expect(parsed.nodes.size).toBe(4);

    expect(parsed.nodes.get('A')?.label).toBe('API Gateway');
    expect(parsed.nodes.get('A')?.shape).toBe('rectangle');

    expect(parsed.nodes.get('B')?.label).toBe('Auth Service');
    expect(parsed.nodes.get('B')?.shape).toBe('diamond');

    expect(parsed.nodes.get('C')?.shape).toBe('sys-database');
    expect(parsed.nodes.get('D')?.shape).toBe('ellipse');

    expect(parsed.edges.length).toBe(3);
    expect(parsed.edges[0].label).toBe('auth');
    expect(parsed.edges[0].fromId).toBe('A');
    expect(parsed.edges[0].toId).toBe('B');
  });

  it('lays out parsed nodes and edges onto a canvas page without overlapping', () => {
    const mermaid = `
      flowchart TD
      Frontend[Web App] --> Backend[Go Server]
      Backend --> Database[(PostgreSQL)]
    `;

    const parsed = parseMermaidFlowchart(mermaid);
    const { nodes, edges } = layoutDiagramToCanvas(parsed);

    expect(nodes.length).toBe(3);
    expect(edges.length).toBe(2);

    // Topological/layered vertical layout: Y coordinates must increase down the flow
    const feNode = nodes.find((n) => n.text?.includes('Web App'));
    const beNode = nodes.find((n) => n.text?.includes('Go Server'));
    const dbNode = nodes.find((n) => n.text?.includes('PostgreSQL'));

    expect(feNode).toBeDefined();
    expect(beNode).toBeDefined();
    expect(dbNode).toBeDefined();

    expect(beNode!.y).toBeGreaterThan(feNode!.y);
    expect(dbNode!.y).toBeGreaterThan(beNode!.y);
  });

  it('performs two-way round-trip: canvas nodes/edges serialize back to valid Mermaid', () => {
    const mermaidInput = `flowchart TD
A[Client] --> B[Server]
B --> C[Storage]`;

    const parsed = parseMermaidFlowchart(mermaidInput);
    const { nodes, edges } = layoutDiagramToCanvas(parsed);

    const serializedMermaid = serializeCanvasToMermaid(nodes, edges);
    expect(serializedMermaid).toContain('flowchart');
    expect(serializedMermaid).toContain('Client');
    expect(serializedMermaid).toContain('Server');
    expect(serializedMermaid).toContain('Storage');
    expect(serializedMermaid).toContain('-->');
  });
});
