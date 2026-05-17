# Ollama/vLLM Integration Plan

## Overview
This document outlines the approach for enhancing the largelanguage-mortgage project to better support open source LLMs hosted with Ollama or vLLM. The project already has foundational support through its LiteLLM proxy architecture, but this enhancement will make it more flexible and user-friendly.

## Current Architecture Review

The existing system uses LiteLLM as a proxy that supports:
- Claude (Anthropic)
- GPT-4o (OpenAI) 
- Local Ollama models (`mortgage-advisor-local`)

The current configuration in `services/litellm/config.yaml` already includes:
```yaml
- model_name: mortgage-advisor-local
  litellm_params:
    model: ollama/llama3
    api_base: http://host.docker.internal:11434
```

## Proposed Enhancements

### 1. Enhanced Model Configuration

**Update `services/litellm/config.yaml`** to support:
- More flexible Ollama/vLLM endpoint configuration
- Support for different model names and parameters
- Ability to specify custom endpoints for local deployments

### 2. Frontend Improvements

**Enhance `apps/web/src/views/ChatView.vue`** to include:
- Configuration UI for custom Ollama/vLLM endpoints
- Dropdown for selecting local models or entering custom model names
- Input field for custom endpoints (e.g., http://localhost:11434)

### 3. Backend Configuration

**Extend `apps/api/src/llm/llm.service.ts`** to support:
- Dynamic endpoint handling for local models
- Validation of user-provided endpoints
- Improved error messaging for connection issues

### 4. API Layer Enhancements

**Update `apps/api/src/chat/chat.controller.ts`** to handle:
- Enhanced model parameter processing
- Support for custom model configurations
- Better error handling for local model failures

## Implementation Steps

1. **Configuration Updates**
   - Enhanced LiteLLM configuration to support custom local models
   - Added support for dynamic model parameters in `services/litellm/config.yaml`

2. **Frontend Integration**
   - Enhanced `ChatView.vue` with custom local model configuration UI
   - Added model name and API base URL inputs for custom Ollama/vLLM deployments

3. **Backend Enhancements**
   - Updated API layers to handle custom model parameters
   - Extended `StreamMessageDto` to accept custom parameters
   - Modified `ChatController` and `ChatService` to pass through custom parameters
   - Updated `LlmService` to support custom model configurations

4. **Documentation**
   - Updated README with instructions for using local LLMs
   - Added usage documentation for Ollama/vLLM integration

## Benefits

- Users can connect to their own Ollama/vLLM deployments
- More flexible local development environment
- Better support for different local LLM setups
- Maintains existing functionality and backward compatibility

## Technical Approach

The implementation leverages the existing LiteLLM architecture which already supports Ollama models. The approach includes:

1. **LiteLLM Configuration**: Added a new model alias `mortgage-advisor-custom-local` that uses placeholders for model name and API base URL, allowing dynamic configuration.

2. **Frontend Enhancement**: Added UI controls in ChatView.vue to allow users to specify custom model names and endpoints when selecting the custom local model option.

3. **API Layer Integration**: Extended the API endpoints to pass custom parameters through the request chain to the LLM service.

4. **Backend Handling**: Modified the LLM service to properly handle the custom model parameters and ensure they're correctly passed to LiteLLM.

## User Experience Considerations

- The system maintains backward compatibility with existing configurations
- Users can seamlessly switch between predefined models and custom local models
- Clear error messaging for connection issues
- Configuration persists through user sessions