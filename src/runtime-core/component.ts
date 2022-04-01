/*
 * @Author: Lin zefan
 * @Date: 2022-03-21 22:08:11
 * @LastEditTime: 2022-04-01 12:38:15
 * @LastEditors: Lin zefan
 * @Description: 处理组件类型
 * @FilePath: \mini-vue3\src\runtime-core\component.ts
 *
 */

import { shallowReadonly } from "../reactivity/index";
import { emit } from "./componentEmit";
import { initProps } from "./componentProps";

import { PublicInstanceProxyHandlers } from "./componentPublicInstanceProxyHandlers";
import { initSlots } from "./componentSlot";
import { patch } from "./render";

// 全局变量，接收的是当前实例
let currentInstance = null;

export function processComponent(vnode, container, parentComponent) {
  // TODO，这里会比较vnode，然后做创建、更新操作，这里先处理创建

  // 创建组件
  mountComponent(vnode, container, parentComponent);

  // TODO，更新组件
  //   updateComponent(vnode, container);
}

// -----------------Component创建流程-------------------
function mountComponent(vnode, container, parentComponent) {
  // 初始化Component实例
  const instance = createComponentInstance(vnode, parentComponent);
  // 初始化setup函数return的数据
  setupComponent(instance, container);
  /** 挂载render的this
   * 1. 我们知道render里面可以使用this.xxx，例如setup return的数据、$el、$data等
   * 2. 我们可以借助proxy来挂载我们的实例属性，让proxy代理
   * 3. 最后render的时候，把this指向这个proxy，这样就可以通过 this.xx -> proxy.get(xx) 获取数据
   */
  createProxyInstance(instance);
  // setupRenderEffect
  setupRenderEffect(instance, container);
}

// 初始化Component结构
function createComponentInstance(initVNode, parent) {
  const component = {
    vnode: initVNode,
    type: initVNode.type,
    proxy: null,
    setupState: {},
    props: {},
    slots: {},
    /** 当前的 providers 指向父级的 providers，解决跨层取值，但是有缺陷
     * 1. 引用的关系会影响父组件，当子组件注入同名的foo，就会影响到父组件的foo
     * const father = { foo:1};
       const children = father;
       children.foo =2;
       console.log(father, children)
     */
    providers: parent ? parent.providers : {},
    emit: () => {},
    // 挂载父组件实例
    parent,
  };

  /** 注册emit
   * 1. 通过bind把当前实例给到emit函数
   */
  component.emit = emit.bind(null, component) as any;

  return component;
}

// 初始化组件代理
function createProxyInstance(instance) {
  instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers);
}

// 初始化setup数据
function setupComponent(instance, container) {
  // 初始化props
  initProps(instance, instance.vnode.props);
  // 初始化slots
  initSlots(instance, instance.vnode.children);
  // 初始化setup函数返回值
  setupStatefulComponent(instance, container);
}

// 初始化setup返回值
function setupStatefulComponent(instance, container) {
  /** 获取用户声明的setup函数过程
   * 1. 前面通过createApp将根组件转换为vnode
   * 2. 之后通过createComponentInstance将vnode进行二次包装
   * 3. 最后可以通过instance.type 获取根组件(rootComponent)
   */
  const component = instance.type;

  const { setup } = component;
  if (setup) {
    /**
     * 1. setup接收props、context
     * 2. 设置 currentInstance
     * 2. 执行setup
     */

    setCurrentInstance(instance);
    const setupResult = setup(shallowReadonly(instance.props), {
      emit: instance.emit,
    });
    /** 清除currentInstance
     * 1. 每个组件的getCurrentInstance都是独立的
     * 2. 每次初始化完setup，必须把currentInstance清空，避免影响其他
     * 3. getCurrentInstance 只是 Composition API 的语法糖
     */
    setCurrentInstance(null);
    handleSetupResult(instance, setupResult);
  }
}

// 获取 setup() 的返回值并挂载实例
function handleSetupResult(instance, setupResult) {
  /** 这里有setup返回值有两种情况
   * 1. 是一个函数
   * 2. 是一个对象
   */
  // 如果是对象，将对象注入上下文
  if (typeof setupResult === "object") {
    instance.setupState = setupResult;
  } else {
    // 如果是函数，那么当作render处理TODO
  }

  finishComponentSetup(instance);
}

// 挂载render到实例
function finishComponentSetup(instance) {
  const component = instance.type;
  // 挂载实例的render函数，取当前组件实例声明得render
  if (component.render) {
    instance.render = component.render;
  }
  // TODO而没有 component.render 咋办捏，其实可以通过编译器来自动生成一个 render 函数
  // 这里先不写
}

function setupRenderEffect(instance, container) {
  const { proxy, vnode } = instance;
  // 通过render函数，获取render返回虚拟节点，并绑定render的this
  const subTree = instance.render.call(proxy);
  /**
   * 1. 调用组件render后把结果再次给到patch
   * 2. 再把对应的dom节点append到container
   * 3. 把当前实例传过去，让子组件可以通过parent获取父组件实例
   */
  patch(subTree, container, instance);
  /** 挂载当前的dom元素到$el
   * 1. 当遍历完所有Component组件后，会调用processElement
   * 2. 在processElement中，会创建dom元素，把创建的dom元素挂载到传入的vnode里面
   * 3. 当前的dom元素也就是processElement中创建的dom元素
   */
  vnode.el = subTree.$el;
}

export function getCurrentInstance() {
  return currentInstance;
}

function setCurrentInstance(instance) {
  currentInstance = instance;
}

// ---------------------Component更新流程----------------------
function updateComponent(vnode, container) {}
