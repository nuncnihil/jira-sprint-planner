# Changelog

All notable changes to the Jira Sprint Planning Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-17

### 🎉 **Initial Release - Sprint Planning Revolution**

**The Jira Sprint Planning Tool is here to transform how teams plan sprints!** This release introduces a fast, local-first sprint planning experience that eliminates the pain of slow Jira Cloud bulk operations.

### ✨ Added

#### **Core Sprint Planning Workflow**
- **Complete sprint planning workflow**: Load → Organize → Estimate → Persist
- **Sprint goal focus**: Prominent sprint goal input keeps planning aligned
- **Single-session planning**: Complete 30-minute focused planning sessions (vs 60-90 minutes across multiple sessions in Jira)

#### **Data Loading & Management**
- **Snapshot-based loading**: Load all sprint, backlog, initiative, and epic data in ~2-3 seconds
- **Board and sprint selection**: Simple dropdown interface for context selection
- **Dynamic field discovery**: Automatic detection of Jira custom fields for portability across instances
- **Real-time data persistence**: Save changes back to Jira with conflict detection

#### **Visual Planning Experience**
- **Color-coded hierarchy**: Initiatives and epics use color families for fast visual pattern recognition
- **Collapsible sections**: Organized view of sprints and backlog with expand/collapse
- **Issue sorting**: Automatic sorting by initiative → epic for logical organization
- **Capacity tracking**: Real-time percentage calculations for sprint balance
- **Category management**: Sprint Goal, Engineering Excellence, and Other work categorization

#### **Bulk Operations (The Game-Changer)**
- **Multi-select operations**: Cmd/Ctrl+Click to select multiple issues
- **Bulk epic assignment**: Assign epics to multiple issues simultaneously
- **Bulk sprint moves**: Move multiple issues between sprints and backlog
- **Right-click context menu**: Powerful bulk operation shortcuts

#### **Professional Data Management**
- **Pending changes tracking**: See all unsaved changes before committing
- **Conflict detection**: Detect when Jira data changed since loading
- **Bulk save operations**: Commit all changes to Jira in optimized batches
- **Change history**: Track what was modified during planning session

#### **User Experience Excellence**
- **Story point editing**: Inline editing with immediate visual feedback
- **Category selection**: Dropdown selectors for work categorization
- **Description viewing**: ADF to Markdown conversion for readable issue descriptions
- **Responsive design**: Clean, distraction-free planning interface

#### **Technical Foundation**
- **Client-server architecture**: Separate React frontend and Express backend
- **Comprehensive test suite**: 142+ unit tests with 100% coverage of business logic
- **API-first design**: RESTful endpoints for all planning operations
- **Configuration management**: Environment-based Jira instance configuration
- **Error handling**: Robust error handling with user-friendly messages

### 🔧 Changed

- **N/A** - This is the initial release

### 🐛 Fixed

- **N/A** - This is the initial release

### 🚀 Performance Improvements

- **2-3 second data loading**: vs 2-5 minutes of clicking through Jira
- **< 50ms UI interactions**: Instant response to all user actions
- **Bulk API operations**: Minimize Jira API calls for better performance
- **Local-first architecture**: No network lag during planning operations

### 📚 Documentation

- **Complete setup guide**: Environment configuration and troubleshooting
- **API documentation**: RESTful endpoint specifications
- **Architecture overview**: System design and technical decisions
- **Testing guide**: Comprehensive test strategy and execution

### 🔒 Security

- **API token authentication**: Secure Jira API access
- **Environment variable management**: Sensitive credentials properly isolated
- **No credential storage**: All authentication handled via environment variables

---

## 🔮 **Known Limitations (V1.0.0)**

These features are not yet implemented but planned for future releases:

### **Comment System** ⚠️
- Comment UI is present but non-functional
- Add comments directly in Jira Cloud for now
- **Coming in V1.1**: Full comment system with @mentions

### **Advanced Features**
- Single board support (multi-board in V2.0)
- Manual test data setup required
- No drag-and-drop reordering
- No epic creation from planner

---

## 🎯 **Success Metrics (V1.0.0)**

**Target Impact:**
- **50-70% time savings**: Reduce sprint planning from 60-90 minutes to 30 minutes
- **Single-session completion**: 90%+ of sprints planned in one focused session
- **Sprint goal alignment**: 60-70% of sprint capacity allocated to goal-supporting work
- **User satisfaction**: Teams prefer the tool over native Jira planning

---

## 🙏 Acknowledgments

Built with frustration from slow Jira Cloud planning sessions. Special thanks to the early adopters who provided feedback during development.

---

## 📞 Support

For issues, questions, or contributions:
- Check the [README](README.md) for setup instructions
- Review [INSTALLATION.md](docs/INSTALLATION.md) for deployment help
- See [SETUP.md](docs/SETUP.md) for detailed configuration
- File issues on the project repository

---

**Ready to revolutionize your sprint planning?** Get started with the [Quick Start Guide](README.md#quick-start)!