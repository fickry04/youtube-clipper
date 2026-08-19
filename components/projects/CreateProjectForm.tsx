'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? 'Failed to create project.');
        return;
      }

      router.push(`/dashboard/projects/${data.project.id}`);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="create-project-form">
      {error && (
        <div className="form-error" role="alert">{error}</div>
      )}
      <div className="form-field">
        <label htmlFor="project-name" className="form-label">Project Name *</label>
        <input
          id="project-name"
          type="text"
          className="form-input"
          placeholder="My YouTube Channel"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
          maxLength={100}
        />
      </div>
      <div className="form-field">
        <label htmlFor="project-description" className="form-label">Description <span className="form-optional">(optional)</span></label>
        <textarea
          id="project-description"
          className="form-textarea"
          placeholder="What is this project about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          rows={3}
          maxLength={500}
        />
      </div>
      <button
        id="create-project-submit-btn"
        type="submit"
        className="form-submit-btn"
        disabled={isLoading}
      >
        {isLoading ? 'Creating…' : 'Create Project'}
      </button>
    </form>
  );
}
