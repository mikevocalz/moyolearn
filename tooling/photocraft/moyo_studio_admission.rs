// Original host fixtures against PhotoCraft's verified public Session facade.
// SOT: docs/business/photocraft-admission.md
// SOT-KEYWORDS: photocraft engine admission session isolation mutation tests
use std::sync::Arc;
use photocraft_engine::{EngineError, Result, Session, command_specs};
use serde_json::json;

fn new_design() -> Result<Session> {
    let mut session = Session::new();
    session.execute("file.new", json!({"width": 64, "height": 32, "mode": "rgb"}))?;
    Ok(session)
}

#[test]
fn creates_a_document_through_the_public_command_facade() -> Result<()> {
    let session = new_design()?;
    assert!(session.active().is_some());
    Ok(())
}

#[test]
fn rejected_command_does_not_replace_the_document() -> Result<()> {
    let mut session = new_design()?;
    let before = session.active().ok_or(EngineError::NoDocument)?.doc.clone();
    assert!(session.execute("moyo.unsupported.command", json!({})).is_err());
    let after = &session.active().ok_or(EngineError::NoDocument)?.doc;
    assert!(Arc::ptr_eq(&before, after));
    Ok(())
}

#[test]
fn separate_editor_sessions_do_not_share_document_ownership() -> Result<()> {
    let first = new_design()?;
    let second = new_design()?;
    let first_doc = &first.active().ok_or(EngineError::NoDocument)?.doc;
    let second_doc = &second.active().ok_or(EngineError::NoDocument)?.doc;
    assert!(!Arc::ptr_eq(first_doc, second_doc));
    assert!(Session::new().active().is_none());
    Ok(())
}

#[test]
fn required_public_command_metadata_is_present() {
    for id in ["file.new", "edit.undo", "edit.redo"] {
        assert!(command_specs().iter().any(|command| command.id == id), "missing command {id}");
    }
}
