import * as renderer from '../renderer'
import * as shaders from '../shaders/shaders'
import { Stage } from '../stage/stage'

export class ForwardPlusRenderer extends renderer.Renderer {
  // TODO-2: add layouts, pipelines, textures, etc. needed for Forward+ here
  // you may need extra uniforms such as the camera view matrix and the canvas resolution

  // uniform buffer
  bindGroupLayout: GPUBindGroupLayout
  bindGroup: GPUBindGroup

  depthTexture: GPUTexture
  depthTextureView: GPUTextureView

  pipeline: GPURenderPipeline

  constructor(stage: Stage) {
    super(stage)

    // TODO-2: initialize layouts, pipelines, textures, etc. needed for Forward+ her

    this.bindGroupLayout = renderer.device.createBindGroupLayout({
      label: 'forward plus bind group layout',
      entries: [
        {
          // camera
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          // lightSet
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
        {
          // cluster array
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' },
        },
        { // light index array
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {type: 'storage'}
        }
      ],
    })

    this.bindGroup = renderer.device.createBindGroup({
      label: 'forward plus bind group',
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.camera.uniformsBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.lights.lightSetStorageBuffer },
        },
        {
          // cluster light indices
          binding: 2,
          resource: { buffer: this.lights.clusterBuffer},
        },
        { // light index buffer
          binding: 3,
          resource: {buffer: this.lights.lightIndicesBuffer }
        }
      ],
    })

    // depth
    this.depthTexture = renderer.device.createTexture({
      size: [renderer.canvas.width, renderer.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
    this.depthTextureView = this.depthTexture.createView()

    this.pipeline = renderer.device.createRenderPipeline({
      layout: renderer.device.createPipelineLayout({
        label: 'forward plus pipeline layout',
        bindGroupLayouts: [
          this.bindGroupLayout,
          renderer.modelBindGroupLayout,
          renderer.materialBindGroupLayout,
        ],
      }),
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
      vertex: {
        module: renderer.device.createShaderModule({
          label: 'forward plus vert shader',
          code: shaders.naiveVertSrc,
        }),
        buffers: [renderer.vertexBufferLayout],
      },
      fragment: {
        module: renderer.device.createShaderModule({
          label: 'forward plus frag shader',
          code: shaders.forwardPlusFragSrc,
        }),
        targets: [
          {
            format: renderer.canvasFormat,
          },
        ],
      },
    })
  }

  override draw() {
    // TODO-2: run the Forward+ rendering pass:
    // - run the clustering compute shader
    // - run the main rendering pass, using the computed clusters for efficient lighting

    const encoder = renderer.device.createCommandEncoder();
    const canvasTextureView = renderer.context.getCurrentTexture().createView()

    // compute pass
    this.lights.doLightClustering(encoder);

    // graphics pass
    const renderPass = encoder.beginRenderPass({
      label: 'forward render pass',
      colorAttachments: [
        {
          view: canvasTextureView,
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })
    renderPass.setPipeline(this.pipeline)

    renderPass.setBindGroup(shaders.constants.bindGroup_scene, this.bindGroup)

    this.scene.iterate(
      (node) => {
        renderPass.setBindGroup(
          shaders.constants.bindGroup_model,
          node.modelBindGroup
        )
      },
      (material) => {
        renderPass.setBindGroup(
          shaders.constants.bindGroup_material,
          material.materialBindGroup
        )
      },
      (primitive) => {
        renderPass.setVertexBuffer(0, primitive.vertexBuffer)
        renderPass.setIndexBuffer(primitive.indexBuffer, 'uint32')
        renderPass.drawIndexed(primitive.numIndices)
      }
    )

    renderPass.end()

    renderer.device.queue.submit([encoder.finish()])
  }
}
