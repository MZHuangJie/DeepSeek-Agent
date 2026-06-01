// src/renderer/components/chat/CreateGroupDialog.tsx
import React, { useState } from 'react';
import { useRoleplayStore } from '../../stores/roleplay';
import { useAgentRolesStore } from '../../stores/agentRoles';
import { useConversationStore } from '../../stores/conversationStore';
import type { ConversationMember } from '../../../common/conversation';
import styles from './CreateGroupDialog.module.css';

interface Props {
  groupType: 'group_npc' | 'group_agent';
  onClose: () => void;
}

export default function CreateGroupDialog({ groupType, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const createGroup = useConversationStore(s => s.createGroup);
  const npcs = useRoleplayStore(s => s.characters);
  const agentRoles = useAgentRolesStore(s => s.roles);

  // Build systemPrompt for NPCs from their character data
  const itemsWithPrompts = groupType === 'group_npc'
    ? npcs.map(c => {
        const parts: string[] = [];
        if (c.personality) parts.push(`性格：${c.personality}`);
        if (c.occupation) parts.push(`职业：${c.occupation}`);
        if (c.background) parts.push(`背景：${c.background}`);
        if (c.gender) parts.push(`性别：${c.gender}`);
        return {
          id: c.id, name: c.name,
          desc: c.personality || c.occupation || '',
          avatar: c.portraitPath,
          systemPrompt: parts.length > 0 ? `你是${c.name}。${parts.join('。')}。请以${c.name}的身份参与群聊，保持角色人设一致。` : '',
        };
      })
    : agentRoles.map(r => ({ id: r.id, name: r.name, desc: r.description || '', avatar: undefined, systemPrompt: r.systemPrompt }));

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    const selected = itemsWithPrompts.filter(item => selectedIds.has(item.id));
    if (selected.length < 2) return;

    const members: ConversationMember[] = selected.map(item => ({
      roleId: item.id,
      roleType: groupType === 'group_npc' ? 'npc' : 'agent',
      name: item.name,
      avatar: item.avatar,
      systemPrompt: item.systemPrompt,
    }));

    const conv = createGroup(groupType, members, name.trim() || undefined);
    if (conv) onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>
            {groupType === 'group_npc' ? '🎭 新建 NPC 群聊' : '💼 新建 Agent 群聊'}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.memberList}>
          {itemsWithPrompts.map(item => {
            const isSel = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`${styles.memberItem} ${isSel ? styles.memberItemSelected : ''}`}
                onClick={() => toggle(item.id)}
              >
                <div className={styles.avatar} style={{
                  background: item.avatar
                    ? `url(${item.avatar}) center/cover`
                    : `linear-gradient(135deg, ${item.name.charCodeAt(0) % 2 ? '#667eea' : '#f5576c'}, ${item.name.charCodeAt(1) % 2 ? '#764ba2' : '#4facfe'})`
                }}>
                  {!item.avatar && item.name[0]}
                </div>
                <div className={styles.memberInfo}>
                  <div className={styles.memberName}>{item.name}</div>
                  {item.desc && <div className={styles.memberDesc}>{item.desc}</div>}
                </div>
                <div className={`${styles.checkbox} ${isSel ? styles.checkboxChecked : ''}`}>
                  {isSel && '✓'}
                </div>
              </div>
            );
          })}
        </div>
        <input
          className={styles.nameInput}
          placeholder="群聊名称（可留空）"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button
          className={styles.createBtn}
          disabled={selectedIds.size < 2}
          onClick={handleCreate}
        >
          创建群聊 ({selectedIds.size} 人)
        </button>
      </div>
    </div>
  );
}
