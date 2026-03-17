import { useState } from "react";
import dayjs from "dayjs";
import { Block } from "../models";
import styles from "./BlockList.module.css";

interface BlockListProps {
  blocks: Block[];
  onDelete: (id: number) => void;
  onEdit: (block: Block) => void;
  onToggleComplete: (id: number, completed: boolean) => void;
}

interface BlockCardProps {
  block: Block;
  onDelete: (id: number) => void;
  onEdit: (block: Block) => void;
  onToggleComplete: (id: number, completed: boolean) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function CategoryTag({ name }: { name: string }) {
  return (
    <span
      className={styles.tag}
      style={
        {
          "--cat-color": `var(--cat-${name.replace(/\s/g, "")}, #aaa)`,
        } as React.CSSProperties
      }
    >
      {name}
    </span>
  );
}

function BlockCard({
  block,
  onDelete,
  onEdit,
  onToggleComplete,
}: BlockCardProps) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    await onToggleComplete(block.id, !block.completed);
    setToggling(false);
  };

  return (
    <div
      className={`${styles.card} ${block.completed ? styles.completed : ""}`}
    >
      <button
        className={`${styles.checkBtn} ${block.completed ? styles.checked : ""}`}
        onClick={handleToggle}
        disabled={toggling}
        title={block.completed ? "Mark as incomplete" : "Mark as complete"}
      >
        {block.completed ? "✓" : ""}
      </button>

      <div className={styles.cardLeft}>
        <div className={styles.time}>
          {block.startTime.slice(0, 5)} – {block.endTime.slice(0, 5)}
        </div>
        <div className={styles.duration}>
          {formatDuration(block.durationMinutes)}
        </div>
      </div>

      <div
        className={styles.cardBody}
        onClick={() => onEdit(block)}
        style={{ cursor: "pointer" }}
      >
        <h4
          className={`${styles.blockTitle} ${block.completed ? styles.completedTitle : ""}`}
        >
          {block.title}
        </h4>
        {block.description && (
          <p className={styles.desc}>{block.description}</p>
        )}
        <div className={styles.tags}>
          {block.categories.map((cat) => (
            <CategoryTag key={cat} name={cat} />
          ))}
        </div>
      </div>

      <button
        className={styles.deleteBtn}
        onClick={() => onDelete(block.id)}
        title="Delete"
      >
        ✕
      </button>
    </div>
  );
}

export default function BlockList({
  blocks,
  onDelete,
  onEdit,
  onToggleComplete,
}: BlockListProps) {
  const grouped = blocks.reduce<Record<string, Block[]>>((acc, block) => {
    if (!acc[block.date]) acc[block.date] = [];
    acc[block.date].push(block);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className={styles.list}>
      {sortedDates.map((date) => (
        <section key={date} className={styles.dateGroup}>
          <h3 className={styles.dateLabel}>
            {dayjs(date).format("dddd, D MMMM YYYY")}
          </h3>
          <div className={styles.cards}>
            {grouped[date]
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((block) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onToggleComplete={onToggleComplete}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
