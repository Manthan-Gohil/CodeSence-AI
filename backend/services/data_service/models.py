# services/data_service/models.py
"""
Shared models for Data Service - used by Application Service
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class RepoMetadata(Base):
    __tablename__ = "repo_metadata"
    repo_url = Column(String, primary_key=True)
    file_tree_json = Column(Text, nullable=False)
    analytics_json = Column(Text)
    dependency_graph_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ActiveRepo(Base):
    __tablename__ = "active_repos"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    repo_url = Column(String, nullable=False)
    provider = Column(String, nullable=False, default="ollama")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True)
    namespace = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)