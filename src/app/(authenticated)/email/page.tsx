'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Mail, Sparkles, Plus, Check, RotateCcw, Save, Trash2, Sliders, FileText,
    Eye, Shield, Copy, ChevronRight, HelpCircle, Layers, Tag, Info, Zap
} from 'lucide-react';
import {
    SystemEmailTemplate,
    TemplateRule,
    getInternalTemplates,
    saveInternalTemplate,
    resetInternalTemplates,
    AVAILABLE_VARIABLES,
    STANDARD_RULES,
    renderInternalDraft,
    renderInternalCopilotPrompt,
    TemplateContext,
} from '@/lib/internalTemplateStore';

// Sample context for live previewing in studio
const SAMPLE_CONTEXT: TemplateContext = {
    clientName: 'Puja Sarna',
    clientEmail: 'puja.sarna@example.com',
    policyNumber: 'CFP-9842104',
    propertyAddress: '1234 Bass Lake Rd, Bass Lake, CA 93604',
    agentName: 'Carlos Paz',
    expirationDate: '07/27/2026',
    effectiveDate: '07/27/2025',
    annualPremium: '$1,850.00',
    paymentMethod: 'Insured Billed',
    reportUrl: 'https://coveragechecknow.com/report/demo-123',
    rceDownloadUrl: 'https://coveragechecknow.com/api/documents/rce-demo.pdf',
    meetingUrl: 'https://outlook.office365.com/owa/calendar/alsopagency/bookings/',
};

export default function EmailTemplateStudioPage() {
    const [templates, setTemplates] = useState<SystemEmailTemplate[]>([]);
    const [selectedId, setSelectedId] = useState<string>('rce_verification');
    const [activeStudioTab, setActiveStudioTab] = useState<'editor' | 'rules' | 'preview'>('editor');
    
    // Form state for current template
    const [editedTemplate, setEditedTemplate] = useState<SystemEmailTemplate | null>(null);
    const [newRuleLabel, setNewRuleLabel] = useState('');
    const [newRuleInstruction, setNewRuleInstruction] = useState('');
    const [savedNotice, setSavedNotice] = useState(false);

    // Load templates on mount
    useEffect(() => {
        const loaded = getInternalTemplates();
        setTemplates(loaded);
        if (loaded.length > 0) {
            setSelectedId(loaded[0].id);
            setEditedTemplate(loaded[0]);
        }
    }, []);

    // Handle template selection
    const handleSelectTemplate = (id: string) => {
        const found = templates.find(t => t.id === id);
        if (found) {
            setSelectedId(id);
            setEditedTemplate(JSON.parse(JSON.stringify(found)));
        }
    };

    // Insert variable tag into active input field
    const insertVariableTag = (tag: string, targetField: 'subject' | 'draft' | 'prompt') => {
        if (!editedTemplate) return;
        if (targetField === 'subject') {
            setEditedTemplate({
                ...editedTemplate,
                subjectTemplate: editedTemplate.subjectTemplate + ' ' + tag,
            });
        } else if (targetField === 'draft') {
            setEditedTemplate({
                ...editedTemplate,
                draftBodyTemplate: editedTemplate.draftBodyTemplate + ' ' + tag,
            });
        } else if (targetField === 'prompt') {
            setEditedTemplate({
                ...editedTemplate,
                copilotPromptTemplate: editedTemplate.copilotPromptTemplate + ' ' + tag,
            });
        }
    };

    // Toggle rule
    const handleToggleRule = (ruleId: string) => {
        if (!editedTemplate) return;
        const updatedRules = editedTemplate.rules.map(r => 
            r.id === ruleId ? { ...r, enabled: !r.enabled } : r
        );
        setEditedTemplate({ ...editedTemplate, rules: updatedRules });
    };

    // Add new rule
    const handleAddCustomRule = () => {
        if (!editedTemplate || !newRuleLabel.trim() || !newRuleInstruction.trim()) return;
        const newRule: TemplateRule = {
            id: 'custom_' + Date.now(),
            label: newRuleLabel.trim(),
            instruction: newRuleInstruction.trim(),
            enabled: true,
        };
        setEditedTemplate({
            ...editedTemplate,
            rules: [...editedTemplate.rules, newRule],
        });
        setNewRuleLabel('');
        setNewRuleInstruction('');
    };

    // Save template
    const handleSave = () => {
        if (!editedTemplate) return;
        saveInternalTemplate(editedTemplate);
        const updatedList = getInternalTemplates();
        setTemplates(updatedList);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
    };

    // Create new custom template
    const handleCreateNewTemplate = () => {
        const newId = 'custom_template_' + Date.now();
        const newTpl: SystemEmailTemplate = {
            id: newId,
            name: 'New Custom Template',
            category: 'custom',
            description: 'Custom agency email outreach template.',
            subjectTemplate: 'Notice regarding {{property_address}}',
            draftBodyTemplate: 'Dear {{first_name}},\n\n[Write your custom message here]\n\nBest regards,\n{{agent_name}}',
            copilotPromptTemplate: 'Draft a custom email for {{client_name}} regarding policy {{policy_number}}.',
            rules: [...STANDARD_RULES],
            variables: ['{{first_name}}', '{{policy_number}}', '{{property_address}}', '{{agent_name}}'],
            isSystemDefault: false,
        };
        saveInternalTemplate(newTpl);
        const updated = getInternalTemplates();
        setTemplates(updated);
        setSelectedId(newId);
        setEditedTemplate(newTpl);
    };

    // Reset to factory defaults
    const handleResetAll = () => {
        if (confirm('Are you sure you want to reset all templates to system defaults? Custom changes will be cleared.')) {
            resetInternalTemplates();
            const reloaded = getInternalTemplates();
            setTemplates(reloaded);
            if (reloaded.length > 0) {
                setSelectedId(reloaded[0].id);
                setEditedTemplate(reloaded[0]);
            }
        }
    };

    const renderedDraft = useMemo(() => {
        if (!editedTemplate) return { subject: '', body: '' };
        return renderInternalDraft(editedTemplate, SAMPLE_CONTEXT);
    }, [editedTemplate]);

    const renderedCopilotPrompt = useMemo(() => {
        if (!editedTemplate) return '';
        return renderInternalCopilotPrompt(editedTemplate, SAMPLE_CONTEXT);
    }, [editedTemplate]);

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-high)' }}>
            
            {/* ── Page Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Mail style={{ color: 'var(--accent-secondary)' }} />
                        Email Template & Rule Studio
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-mid)', margin: '0.25rem 0 0 0' }}>
                        Build internal email templates and configure agency rules that apply to generated email drafts and CoPilot prompts.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={handleResetAll}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.5rem 0.9rem', borderRadius: '7px',
                            background: 'transparent', color: 'var(--text-mid)',
                            border: '1px solid var(--border-default)', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 500,
                        }}
                    >
                        <RotateCcw size={14} />
                        Reset Defaults
                    </button>
                    <button
                        onClick={handleCreateNewTemplate}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.5rem 1rem', borderRadius: '7px',
                            background: 'var(--accent-secondary-muted)', color: 'var(--accent-secondary)',
                            border: '1px solid var(--border-default)', cursor: 'pointer',
                            fontSize: '0.82rem', fontWeight: 600,
                        }}
                    >
                        <Plus size={14} />
                        New Template
                    </button>
                </div>
            </div>

            {/* ── Main Studio Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
                
                {/* ── Left Sidebar: Template Navigation ── */}
                <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex', flexDirection: 'column', gap: '1rem',
                }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Agency Templates ({templates.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {templates.map(t => {
                            const isSelected = t.id === selectedId;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => handleSelectTemplate(t.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.75rem 0.85rem', borderRadius: '8px', textAlign: 'left',
                                        cursor: 'pointer', border: '1px solid',
                                        background: isSelected ? 'var(--accent-secondary-muted)' : 'transparent',
                                        borderColor: isSelected ? 'var(--border-default)' : 'transparent',
                                        color: isSelected ? 'var(--accent-secondary)' : 'var(--text-mid)',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: '0.84rem', fontWeight: isSelected ? 700 : 500 }}>
                                            {t.name}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: isSelected ? 'var(--accent-secondary)' : 'var(--text-muted)', marginTop: '0.15rem' }}>
                                            {t.category.toUpperCase()} • {t.rules.filter(r => r.enabled).length} Active Rules
                                        </div>
                                    </div>
                                    <ChevronRight size={14} style={{ opacity: isSelected ? 1 : 0.4 }} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Main Panel: Studio Workbench ── */}
                {editedTemplate ? (
                    <div style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '12px',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        
                        {/* Workbench Tab Header */}
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderBottom: '1px solid var(--border-default)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--bg-surface-raised)',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                                    {editedTemplate.name}
                                </h2>
                                <p style={{ fontSize: '0.76rem', color: 'var(--text-mid)', margin: '0.15rem 0 0 0' }}>
                                    {editedTemplate.description}
                                </p>
                            </div>

                            {/* Segmented Tab Controls */}
                            <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--border-subtle)', padding: '3px', borderRadius: '7px' }}>
                                <button
                                    onClick={() => setActiveStudioTab('editor')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                        padding: '0.4rem 0.8rem', borderRadius: '5px', fontSize: '0.76rem', fontWeight: 600,
                                        cursor: 'pointer', border: 'none',
                                        background: activeStudioTab === 'editor' ? 'var(--bg-surface-raised)' : 'transparent',
                                        color: activeStudioTab === 'editor' ? 'var(--text-high)' : 'var(--text-mid)',
                                        boxShadow: activeStudioTab === 'editor' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                    }}
                                >
                                    <FileText size={13} /> Editor
                                </button>
                                <button
                                    onClick={() => setActiveStudioTab('rules')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                        padding: '0.4rem 0.8rem', borderRadius: '5px', fontSize: '0.76rem', fontWeight: 600,
                                        cursor: 'pointer', border: 'none',
                                        background: activeStudioTab === 'rules' ? 'var(--bg-surface-raised)' : 'transparent',
                                        color: activeStudioTab === 'rules' ? 'var(--text-high)' : 'var(--text-mid)',
                                        boxShadow: activeStudioTab === 'rules' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                    }}
                                >
                                    <Sliders size={13} /> Rules ({editedTemplate.rules.filter(r => r.enabled).length})
                                </button>
                                <button
                                    onClick={() => setActiveStudioTab('preview')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                        padding: '0.4rem 0.8rem', borderRadius: '5px', fontSize: '0.76rem', fontWeight: 600,
                                        cursor: 'pointer', border: 'none',
                                        background: activeStudioTab === 'preview' ? 'var(--bg-surface-raised)' : 'transparent',
                                        color: activeStudioTab === 'preview' ? 'var(--text-high)' : 'var(--text-mid)',
                                        boxShadow: activeStudioTab === 'preview' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                    }}
                                >
                                    <Eye size={13} /> Live Preview
                                </button>
                            </div>
                        </div>

                        {/* ── Studio Body ── */}
                        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
                            
                            {/* ── TAB 1: EDITOR ── */}
                            {activeStudioTab === 'editor' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    
                                    {/* Template Metadata */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: '0.3rem' }}>
                                                Template Name
                                            </label>
                                            <input
                                                type="text"
                                                value={editedTemplate.name}
                                                onChange={e => setEditedTemplate({ ...editedTemplate, name: e.target.value })}
                                                style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '7px', color: 'var(--text-high)', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: '0.3rem' }}>
                                                Category
                                            </label>
                                            <select
                                                value={editedTemplate.category}
                                                onChange={e => setEditedTemplate({ ...editedTemplate, category: e.target.value as any })}
                                                style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '7px', color: 'var(--text-high)', fontSize: '0.85rem', cursor: 'pointer' }}
                                            >
                                                <option value="rce">RCE Property Data</option>
                                                <option value="recommendations">Coverage Recommendations</option>
                                                <option value="renewal">Renewal Notice</option>
                                                <option value="review">Coverage Review</option>
                                                <option value="custom">Custom</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Variable Chip Insertion Palette */}
                                    <div style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '0.85rem' }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <Tag size={12} /> Click to Insert Context Variable
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {AVAILABLE_VARIABLES.map(v => (
                                                <button
                                                    key={v.tag}
                                                    onClick={() => insertVariableTag(v.tag, 'draft')}
                                                    title={v.description}
                                                    style={{
                                                        padding: '0.25rem 0.55rem', borderRadius: '5px', fontSize: '0.72rem',
                                                        background: 'var(--bg-surface-raised)', color: 'var(--accent-secondary)',
                                                        border: '1px solid var(--border-default)', cursor: 'pointer',
                                                    }}
                                                >
                                                    {v.tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Subject Line Template */}
                                    <div>
                                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: '0.3rem' }}>
                                            Email Subject Line Template
                                        </label>
                                        <input
                                            type="text"
                                            value={editedTemplate.subjectTemplate}
                                            onChange={e => setEditedTemplate({ ...editedTemplate, subjectTemplate: e.target.value })}
                                            style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '7px', color: 'var(--text-high)', fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    {/* Draft Email Body Editor */}
                                    <div>
                                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--semantic-success)', display: 'block', marginBottom: '0.3rem' }}>
                                            Generated Email Draft Body Structure
                                        </label>
                                        <textarea
                                            rows={8}
                                            value={editedTemplate.draftBodyTemplate}
                                            onChange={e => setEditedTemplate({ ...editedTemplate, draftBodyTemplate: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '7px', color: 'var(--text-high)', fontSize: '0.82rem', fontFamily: 'monospace', lineHeight: 1.6 }}
                                        />
                                    </div>

                                    {/* CoPilot Prompt Editor */}
                                    <div>
                                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-secondary)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <Sparkles size={12} /> CoPilot Prompt Template (Allstate CoPilot Instructions)
                                        </label>
                                        <textarea
                                            rows={6}
                                            value={editedTemplate.copilotPromptTemplate}
                                            onChange={e => setEditedTemplate({ ...editedTemplate, copilotPromptTemplate: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '7px', color: 'var(--text-high)', fontSize: '0.82rem', fontFamily: 'monospace', lineHeight: 1.6 }}
                                        />
                                    </div>

                                </div>
                            )}

                            {/* ── TAB 2: RULES ENGINE ── */}
                            {activeStudioTab === 'rules' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)' }}>
                                        Rules defined here are automatically enforced on BOTH the generated email draft and the CoPilot prompt for this template.
                                    </div>

                                    {/* Active Rules List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {editedTemplate.rules.map(r => (
                                            <div
                                                key={r.id}
                                                style={{
                                                    padding: '1rem', borderRadius: '8px',
                                                    background: r.enabled ? 'var(--accent-secondary-muted)' : 'var(--bg-surface-raised)',
                                                    border: `1px solid ${r.enabled ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                                                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: r.enabled ? 'var(--accent-secondary)' : 'var(--text-mid)' }}>
                                                        {r.label}
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-mid)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                                                        {r.instruction}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleRule(r.id)}
                                                    style={{
                                                        padding: '0.3rem 0.7rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 600,
                                                        cursor: 'pointer', border: '1px solid var(--border-default)',
                                                        background: r.enabled ? 'var(--semantic-success)' : 'var(--bg-surface-raised)',
                                                        color: r.enabled ? '#fff' : 'var(--text-mid)',
                                                    }}
                                                >
                                                    {r.enabled ? 'Active Rule' : 'Disabled'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Custom Rule Form */}
                                    <div style={{ marginTop: '1rem', background: 'var(--border-subtle)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '1rem' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-high)', marginBottom: '0.75rem' }}>
                                            Add Custom Template Rule
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                                            <div>
                                                <label style={{ fontSize: '0.68rem', color: 'var(--text-mid)', display: 'block', marginBottom: '0.2rem' }}>Rule Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Include Disclaimer"
                                                    value={newRuleLabel}
                                                    onChange={e => setNewRuleLabel(e.target.value)}
                                                    style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-high)', fontSize: '0.8rem' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.68rem', color: 'var(--text-mid)', display: 'block', marginBottom: '0.2rem' }}>Instruction Text</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Always request client permission before adjusting limits."
                                                    value={newRuleInstruction}
                                                    onChange={e => setNewRuleInstruction(e.target.value)}
                                                    style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-high)', fontSize: '0.8rem' }}
                                                />
                                            </div>
                                            <button
                                                onClick={handleAddCustomRule}
                                                style={{ padding: '0.45rem 0.9rem', borderRadius: '6px', background: 'var(--accent-secondary-muted)', color: 'var(--accent-secondary)', border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                            >
                                                Add Rule
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── TAB 3: LIVE PREVIEW ── */}
                            {activeStudioTab === 'preview' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                    
                                    {/* Email Draft Preview */}
                                    <div>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--semantic-success)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <Mail size={12} /> Interpolated Email Draft
                                        </div>
                                        <div style={{ background: 'var(--bg-surface-raised)', color: 'var(--text-high)', padding: '1.25rem', borderRadius: '8px', fontSize: '0.82rem', lineHeight: 1.6, minHeight: '320px', whiteSpace: 'pre-wrap', border: '1px solid var(--border-default)' }}>
                                            <div style={{ fontWeight: 700, borderBottom: '1px solid var(--border-default)', paddingBottom: '0.5rem', marginBottom: '0.75rem', fontSize: '0.88rem' }}>
                                                Subject: {renderedDraft.subject}
                                            </div>
                                            {renderedDraft.body}
                                        </div>
                                    </div>

                                    {/* CoPilot Prompt Preview */}
                                    <div>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <Sparkles size={12} /> Interpolated CoPilot Prompt
                                        </div>
                                        <div style={{ background: 'var(--bg-surface-raised)', color: 'var(--text-high)', padding: '1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'monospace', lineHeight: 1.6, minHeight: '320px', whiteSpace: 'pre-wrap', border: '1px solid var(--border-default)' }}>
                                            {renderedCopilotPrompt}
                                        </div>
                                    </div>

                                </div>
                            )}

                        </div>

                        {/* Workbench Action Footer */}
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid var(--border-default)',
                            background: 'var(--bg-surface-raised)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-mid)' }}>
                                {savedNotice ? (
                                    <span style={{ color: 'var(--semantic-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Check size={14} /> Template changes saved successfully!
                                    </span>
                                ) : (
                                    'Changes apply immediately to generated drafts and CoPilot prompts.'
                                )}
                            </div>
                            <button
                                onClick={handleSave}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.55rem 1.25rem', borderRadius: '7px',
                                    background: 'var(--semantic-success)', color: '#fff',
                                    border: 'none', cursor: 'pointer',
                                    fontSize: '0.84rem', fontWeight: 600,
                                }}
                            >
                                <Save size={14} />
                                Save Template
                            </button>
                        </div>

                    </div>
                ) : null}

            </div>
        </div>
    );
}
