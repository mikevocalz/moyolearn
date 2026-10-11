'use client';
// A block-based email composer, not a claim of PhotoCraft/iPad engine parity.
// Editable JSON is the source; Mailcheap receives a separately rendered snapshot.
// SOT: docs/business/creative-studio.md
// SOT-KEYWORDS: business campaign studio newsletter blocks preview zustand
import { useEffect, useMemo, useRef } from 'react';
import { Button, Heading, Text, TextField, useInstanceStore, useStore } from '@acme/ui';
import { Textarea, View, Link } from '@acme/ui/primitives';
import { DownloadEmailDocument, EmailBlockFrame, EmailCanvas } from '@acme/ui/email-canvas';
import { BLOCK_KINDS, MAX_BLOCKS, draftReceipt, jsonObject, moveBefore, moveBlock, newBlock, newDocument, parseDocument, parseEditableDocument, readJson, serializeEditableDocument, type CampaignBlock, type CampaignDocument } from '@/lib/campaigns/document';
import { renderCampaign } from '@/lib/campaigns/render';
import { emailTheme } from '@/lib/campaigns/theme';
import type { CampaignSettings } from '@/lib/campaigns/campaigns.service';

const PREVIEW_BRAND = { name: 'Business preview', postalAddress: 'Your configured business address will appear here.' };
function initialState() {
  return { document: newDocument(), history: [] as CampaignDocument[], future: [] as CampaignDocument[],
    compact: false, showImages: false, importing: false, importText: '', dirty: false, pending: false,
    message: '', receipt: null as ReturnType<typeof draftReceipt> | null, uncertain: false, created: false };
}

function BlockFields({ block, disabled, update }: { block: CampaignBlock; disabled: boolean; update: (next: CampaignBlock) => void }) {
  switch (block.kind) {
    case 'heading': return <TextField label="Heading" value={block.text} disabled={disabled} onChangeText={(text) => update({ ...block, text })} />;
    case 'paragraph': return <View className="gap-element"><Text>Paragraph</Text><Textarea aria-label="Paragraph" value={block.text} editable={!disabled} onChangeText={(text) => update({ ...block, text })} className="min-h-32 rounded-control border border-border bg-surface-raised p-inset text-text" /></View>;
    case 'image': return <View className="gap-group"><TextField label="Published image URL (HTTPS)" value={block.src} disabled={disabled} inputMode="url" autoCapitalize="none" onChangeText={(src) => update({ ...block, src })} /><TextField label="Image description" value={block.alt} disabled={disabled} onChangeText={(alt) => update({ ...block, alt })} /><Text tone="muted">Use a published export of your graphic. A PSD, local file path, or private signed URL is not a newsletter image.</Text></View>;
    case 'button': return <View className="gap-group"><TextField label="Button label" value={block.label} disabled={disabled} onChangeText={(label) => update({ ...block, label })} /><TextField label="Button destination (HTTPS)" value={block.href} disabled={disabled} inputMode="url" autoCapitalize="none" onChangeText={(href) => update({ ...block, href })} /></View>;
    case 'divider': return <Text tone="muted">Section divider</Text>;
  }
}

export function CampaignStudio({ settings }: { settings: CampaignSettings }) {
  const store = useInstanceStore(initialState);
  const state = useStore(store, (value) => value);
  const request = useRef<AbortController | null>(null);
  const brand = settings.state === 'ready' ? settings.brand : PREVIEW_BRAND;
  const preview = useMemo(() => {
    try { return { html: renderCampaign(state.document, brand, emailTheme), error: '' }; }
    catch (error) { return { html: '', error: error instanceof Error ? error.message : 'Check your email content.' }; }
  }, [state.document, brand]);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!store.getState().dirty) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [store]);

  function change(next: CampaignDocument) {
    const current = store.getState();
    if (current.pending || next === current.document) return;
    try {
      const document = parseEditableDocument(JSON.stringify(next));
      store.setState({ document, history: [...current.history.slice(-49), current.document], future: [], dirty: true, created: false, message: '' });
    } catch (error) {
      store.setState({ message: error instanceof Error ? error.message : 'This change exceeds the document limits.' });
    }
  }
  function updateBlock(block: CampaignBlock) {
    const current = store.getState().document;
    change({ ...current, blocks: current.blocks.map((item) => item.id === block.id ? block : item) });
  }
  async function createDraft() {
    const current = store.getState();
    if (current.pending || current.uncertain || current.created || settings.state !== 'ready') return;
    let document: CampaignDocument;
    try { document = parseDocument(JSON.stringify(current.document)); }
    catch (error) { store.setState({ message: error instanceof Error ? error.message : 'Check the document.' }); return; }
    const controller = new AbortController(); request.current = controller;
    store.setState({ pending: true, message: '', receipt: null });
    try {
      const response = await fetch('/api/business/campaigns', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(document) });
      if (!response.ok) {
        const value = jsonObject(readJson(await response.text()));
        store.setState({ message: typeof value.error === 'string' ? value.error : 'The draft request failed.', uncertain: response.status >= 500 });
        return;
      }
      const receipt = draftReceipt(await response.text(), settings.origin);
      store.setState({ receipt, created: true, message: 'Draft created in Mailcheap. No email was sent. Download the editable document before leaving.' });
    } catch {
      if (!controller.signal.aborted) store.setState({ uncertain: true, message: 'Draft creation could not be confirmed. Check Mailcheap before creating another draft.' });
    } finally {
      if (request.current === controller) { request.current = null; store.setState({ pending: false }); }
    }
  }

  return <View className="gap-stack p-inset">
    <View className="gap-element"><Heading>Campaign Studio</Heading><Text>Design a newsletter, review its content, then create a Mailcheap draft. Sending is a separate action in Mailcheap.</Text></View>
    {settings.state !== 'ready' ? <Text>Delivery is not configured. You can design and download an editable document; your administrator must connect your business before a draft can be handed off.</Text> : <Text tone="muted">Destination: {settings.newsletter} · {settings.brand.name}</Text>}
    <View className="flex-row flex-wrap gap-element">
      <Button title="Undo" variant="ghost" disabled={state.pending || state.history.length === 0} onPress={() => {
        const current = store.getState(); const previous = current.history.at(-1); if (!previous || current.pending) return;
        store.setState({ document: previous, history: current.history.slice(0, -1), future: [current.document, ...current.future].slice(0, 50), dirty: true, created: false });
      }} />
      <Button title="Redo" variant="ghost" disabled={state.pending || state.future.length === 0} onPress={() => {
        const current = store.getState(); const next = current.future[0]; if (!next || current.pending) return;
        store.setState({ document: next, history: [...current.history.slice(-49), current.document], future: current.future.slice(1), dirty: true, created: false });
      }} />
      <DownloadEmailDocument title="Download editable document" content={serializeEditableDocument(state.document)} filename="moyo-newsletter.json" disabled={state.pending} />
      <Button title="Restore editable document" variant="outline" disabled={state.pending} onPress={() => store.setState({ importing: !store.getState().importing })} />
      <Button title={state.created ? 'Draft created' : state.receipt ? 'Create new Mailcheap draft' : 'Create Mailcheap draft'} loading={state.pending} disabled={settings.state !== 'ready' || !!preview.error || state.uncertain || state.created} onPress={() => void createDraft()} />
    </View>
    <Text tone="muted">The editable document stays in this tab until you download it. Each handoff creates a new Mailcheap draft of the rendered email, not your block-editing history.</Text>
    {state.message ? <View accessibilityLiveRegion="polite"><Text>{state.message}</Text></View> : null}
    {state.receipt ? <Link href={state.receipt.url} target="_blank" rel="noopener noreferrer" className="min-h-target-adult justify-center text-text underline">Open last created draft in Mailcheap</Link> : null}
    {state.uncertain && settings.state === 'ready' ? <View className="gap-element"><Link href={`${settings.origin}/campaigns`} target="_blank" rel="noopener noreferrer" className="min-h-target-adult justify-center text-text underline">Review existing drafts in Mailcheap first</Link><Button title="I checked Mailcheap — allow a new draft" variant="outline" onPress={() => store.setState({ uncertain: false })} /></View> : null}
    {state.importing ? <View className="gap-element"><Text>Paste a previously downloaded Moyo newsletter JSON document. Restoring replaces this tab’s draft and can be undone.</Text><Textarea aria-label="Editable newsletter JSON" value={state.importText} editable={!state.pending} onChangeText={(importText) => store.setState({ importText })} className="min-h-32 rounded-control border border-border p-inset text-text" /><Button title="Restore document" variant="outline" disabled={state.pending} onPress={() => {
      try { change(parseEditableDocument(store.getState().importText)); store.setState({ importing: false, importText: '', message: 'Editable document restored.' }); }
      catch (error) { store.setState({ message: error instanceof Error ? error.message : 'Check the JSON document.' }); }
    }} /></View> : null}
    <View className="gap-stack lg:flex-row">
      <View className="min-w-0 flex-1 gap-group">
        <TextField label="Subject" value={state.document.subject} disabled={state.pending} onChangeText={(subject) => change({ ...store.getState().document, subject })} />
        <TextField label="Inbox preview text" value={state.document.previewText} disabled={state.pending} onChangeText={(previewText) => change({ ...store.getState().document, previewText })} />
        <Heading level={2} size="title">Email blocks</Heading>
        <View className="flex-row flex-wrap gap-element">{BLOCK_KINDS.map((kind) => <Button key={kind} title={`Add ${kind}`} variant="outline" disabled={state.pending || state.document.blocks.length >= MAX_BLOCKS} onPress={() => {
          const current = store.getState().document;
          if (current.blocks.length < MAX_BLOCKS) change({ ...current, blocks: [...current.blocks, newBlock(kind, crypto.randomUUID())] });
        }} />)}</View>
        {state.document.blocks.map((block, index) => <EmailBlockFrame key={block.id} id={block.id} label={`${index + 1}: ${block.kind}`} disabled={state.pending} onMoveBefore={(id, target) => change(moveBefore(store.getState().document, id, target))}>
          <View className="gap-group"><BlockFields block={block} disabled={state.pending} update={updateBlock} /><View className="flex-row flex-wrap gap-element">
            <Button title="Move up" aria-label={`Move ${block.kind} ${index + 1} up`} variant="ghost" disabled={state.pending || index === 0} onPress={() => change(moveBlock(store.getState().document, block.id, -1))} />
            <Button title="Move down" aria-label={`Move ${block.kind} ${index + 1} down`} variant="ghost" disabled={state.pending || index === state.document.blocks.length - 1} onPress={() => change(moveBlock(store.getState().document, block.id, 1))} />
            <Button title="Remove" aria-label={`Remove ${block.kind} ${index + 1}`} variant="ghost" disabled={state.pending || state.document.blocks.length === 1} onPress={() => change({ ...store.getState().document, blocks: store.getState().document.blocks.filter((item) => item.id !== block.id) })} />
          </View></View>
        </EmailBlockFrame>)}
      </View>
      <View className="min-w-0 flex-1 gap-group"><Heading level={2} size="title">Design preview</Heading><View className="flex-row flex-wrap gap-element"><Button title={state.compact ? 'Show desktop width' : 'Show phone width'} variant="outline" onPress={() => store.setState({ compact: !store.getState().compact })} /><Button title={state.showImages ? 'Hide remote images' : 'Load remote images'} variant="ghost" onPress={() => store.setState({ showImages: !store.getState().showImages })} /></View><Text tone="muted">Remote images are blocked until you load them. Inbox preview text and personalized unsubscribe links are applied by Mailcheap. This is not an email-client compatibility test.</Text>
        {preview.error ? <Text>{preview.error}</Text> : <EmailCanvas html={preview.html} compact={state.compact} showImages={state.showImages} />}
      </View>
    </View>
  </View>;
}
