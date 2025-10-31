# Contributing to Real-Time Chat Application

First off, thank you for considering contributing to this project! 🎉

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)

---

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code:
- Be respectful and inclusive
- Welcome newcomers
- Focus on what is best for the community
- Show empathy towards other community members

---

## How Can I Contribute?

### Reporting Bugs
Before creating bug reports, please check existing issues. When creating a bug report, include:
- **Clear descriptive title**
- **Detailed description** of the issue
- **Steps to reproduce** the problem
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Node version, etc.)

### Suggesting Enhancements
Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:
- Use a clear and descriptive title
- Provide a detailed description of the suggested enhancement
- Explain why this enhancement would be useful
- List some examples of how it should work

### Your First Code Contribution
Unsure where to begin? Look for issues labeled:
- `good-first-issue` - Simple issues for beginners
- `help-wanted` - Issues that need attention
- `bug` - Something isn't working
- `enhancement` - New feature or request

---

## Development Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn
- Git

### Setup Steps

1. **Fork the repository**
   ```bash
   # Click the 'Fork' button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/realtime-chat-app.git
   cd realtime-chat-app
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running
   mongod
   ```

6. **Run the application**
   ```bash
   npm run dev
   ```

7. **Run tests**
   ```bash
   npm test
   ```

---

## Coding Standards

### JavaScript Style Guide
We follow standard JavaScript best practices:

```javascript
// ✅ Good
const getUserById = async (userId) => {
  const user = await User.findById(userId);
  return user;
};

// ❌ Bad
function getUserById(userId){
    var user=User.findById(userId)
    return user
}
```

### General Rules
- **Use ES6+ features** (const/let, arrow functions, async/await)
- **Use meaningful variable names**
- **Add comments** for complex logic
- **Follow DRY principle** (Don't Repeat Yourself)
- **Handle errors properly**
- **Use async/await** instead of callbacks
- **Validate all user input**

### File Organization
```
project/
├── models/         # Database models
├── routes/         # API routes
├── middleware/     # Express middleware
├── public/         # Frontend files
├── __tests__/      # Test files
└── server.js       # Main server file
```

### Naming Conventions
- **Files**: `camelCase.js`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_CASE`
- **Routes**: `kebab-case`

---

## Commit Guidelines

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```bash
feat(auth): add password reset functionality

Implemented password reset via email with token expiration.
Includes new endpoints and email templates.

Closes #123
```

```bash
fix(chat): resolve message duplication issue

Fixed bug where messages were sent twice due to
socket reconnection handling.

Fixes #456
```

```bash
docs(api): update API documentation

Added examples for new endpoints and improved
authentication section clarity.
```

---

## Pull Request Process

### Before Submitting

1. **Update your fork**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/realtime-chat-app.git
   git fetch upstream
   git merge upstream/main
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clean, documented code
   - Add tests for new features
   - Update documentation

4. **Test your changes**
   ```bash
   npm test
   npm run dev  # Manual testing
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

### Submitting the PR

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill in the PR template:
   - **Title**: Clear, descriptive summary
   - **Description**: What changes you made and why
   - **Screenshots**: If applicable
   - **Related Issues**: Reference any related issues
   - **Checklist**: Complete the PR checklist

### PR Checklist
- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Changes are backward compatible

---

## Testing Guidelines

### Writing Tests

**Unit Tests**
```javascript
// __tests__/auth.test.js
describe('User Authentication', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
  });
});
```

**Integration Tests**
```javascript
describe('Message Flow', () => {
  it('should send and receive messages', async () => {
    // Test complete message flow
  });
});
```

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- auth.test.js
```

### Test Coverage
- Aim for **>80% coverage**
- Focus on critical paths
- Test edge cases
- Test error handling

---

## Code Review Process

### As a Reviewer
- Be respectful and constructive
- Focus on the code, not the person
- Explain "why" when suggesting changes
- Approve when ready or request changes
- Use GitHub's review features

### As a Contributor
- Be open to feedback
- Ask questions if unclear
- Make requested changes promptly
- Thank reviewers for their time

---

## Additional Resources

- [API Documentation](./API_DOCUMENTATION.md)
- [README](./README.md)
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [MongoDB Manual](https://docs.mongodb.com/manual/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

---

## Questions?

Feel free to:
- Open an issue for discussion
- Ask in pull request comments
- Contact the maintainers

---

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing! 🚀
