import React, { useEffect, useState } from 'react';
import { useAgentRolesStore, AgentRole } from '../../stores/agentRoles';
import { useModelStore } from '../../stores/model';
import styles from './ModelSettings.module.css';

interface Props {
  onClose: () => void;
}

export default function MultiAgentSettings({ onClose }: Props) {
  const { roles, loadRoles, saveRoles } = useAgentRolesStore();
  const { models } = useModelStore();
  const [list, setList] = useState<AgentRole[]>(roles);
  const [editing, setEditing] = useState<AgentRole | null>(null);

  useEffect(() => { void loadRoles(); }, []);
  useEffect(() => { setList(roles); }, [roles]);

  const addRole = () => {
    setEditing({
      id: `role-${Date.now()}`,
      name: '新角色',
      description: '',
      systemPrompt: '',
      modelId: undefined,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const idx = list.findIndex(r => r.id === editing.id);
    if (idx >= 0) {
      setList(l => l.map((r, i) => (i === idx ? editing : r)));
    } else {
      setList(l => [...l, editing]);
    }
    setEditing(null);
  };

  const removeRole = (id: string) => {
    setList(l => l.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    await saveRoles(list);
    onClose();
  };

  const modelName = (modelId?: string) => {
    if (!modelId) return '跟随当前模型';
    return models.find(m => m.id === modelId)?.name ?? modelId;
  };

  return (
    <div className={styles.overlay} data-focus-guard>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>Multi-Agent 角色</span>
          <button onClick={onClose} className={styles.closeBtn}>
            <img src="./assets/图层 12_w.png" alt="close" className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.modelList}>
          <div className={styles.hintText} style={{ marginBottom: 8 }}>
            配置可被「Multi-Agent 模式」协调者分派的角色。每个角色拥有独立的职责 prompt 与模型，任务会并行执行后汇总。
          </div>
          {list.map(role => (
            <div key={role.id} className={`${styles.modelRow} ${styles.modelRowInactive}`}>
              <div className={styles.modelInfo}>
                <div className={styles.modelName}>{role.name}</div>
                <div className={styles.modelMeta}>
                  {modelName(role.modelId)}{role.description ? ` · ${role.description}` : ''}
                </div>
              </div>
              <button onClick={() => setEditing({ ...role })} className={styles.actionBtn}>编辑</button>
              <button onClick={() => removeRole(role.id)} className={styles.deleteBtn}>删除</button>
            </div>
          ))}
          {list.length === 0 && (
            <div className={styles.hintText}>暂无角色，点击下方按钮添加。</div>
          )}
          <button onClick={addRole} className={styles.addBtn}>+ 添加角色</button>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>取消</button>
          <button onClick={handleSave} className={styles.saveBtn}>保存</button>
        </div>
      </div>

      {editing && (
        <div className={styles.overlay} style={{ zIndex: 1001 }}>
          <div className={styles.editPanel}>
            <div className={styles.editTitle}>
              {list.find(r => r.id === editing.id) ? '编辑角色' : '添加角色'}
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>角色名称</div>
              <input
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                className={styles.input}
                placeholder="如：前端实现、测试编写、代码审查"
              />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>职责简介（可选）</div>
              <input
                value={editing.description ?? ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                className={styles.input}
                placeholder="一句话描述该角色擅长什么，供协调者分派参考"
              />
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>模型</div>
              <select
                value={editing.modelId ?? ''}
                onChange={e => setEditing({ ...editing, modelId: e.target.value || undefined })}
                className={styles.select}
              >
                <option value="">跟随当前激活模型</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}（{m.model}）</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>职责 Prompt</div>
              <textarea
                value={editing.systemPrompt}
                onChange={e => setEditing({ ...editing, systemPrompt: e.target.value })}
                className={styles.input}
                style={{ minHeight: 160, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="描述该角色的身份、职责、工作方式与输出要求。例如：你是资深前端工程师，负责实现 UI 组件，遵循项目现有约定，改动后给出文件清单与说明。"
              />
            </div>
            <div className={styles.editFooter}>
              <button onClick={() => setEditing(null)} className={styles.cancelBtn}>取消</button>
              <button onClick={saveEdit} className={styles.saveBtn}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
