# Contributing to Lucida Analytics

Thank you for your interest in contributing to Lucida Analytics!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Follow the setup instructions in `README.md`

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linting:
   ```bash
   # Backend
   cd apps/backend
   python -m pytest -q
   
   # Frontend
   cd apps/frontend
   npm run lint
   npm run build
   ```
4. Commit your changes with a clear message
5. Push to your fork and open a Pull Request

## Code Style

- **Python**: Follow PEP 8 guidelines
- **JavaScript/TypeScript**: ESLint configuration is provided

## Reporting Issues

When reporting issues, please include:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Python/Node versions)

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
